#!/usr/bin/env node
/**
 * Sovereignty Campaigns Worker
 *
 * Polls ESI `/sovereignty/campaigns` and upserts every active sovereignty
 * campaign (and its participating alliances) into the database. Campaigns that
 * were active in a previous run but are no longer returned by ESI are marked as
 * ended (end_time set to now).
 *
 * Usage:
 *   yarn worker:sov:campaigns
 *
 * PM2 Cron:
 *   Runs every 5 minutes via ecosystem.config.js
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { pubsub } from '@services/pubsub';
import { buildSovereigntyAlert } from '@services/sovereignty/alert-builder';
import { SovereigntyService } from '@services/sovereignty/sovereignty.service';

// "Nobody really contested" threshold for outcome inference (scores are 0..1).
const OUTCOME_EPS = 0.05;

// Cap alerts per run so a first-run/reseed or a big shift can't flood clients.
const MAX_ALERTS = 25;

/**
 * Infers a campaign outcome from its last-known scores when it ends. Heuristic
 * (ESI gives no explicit resolution event): defender wins ties; if neither side
 * made meaningful progress the window lapsed uncontested → abandoned.
 */
function inferOutcome(defenderScore: number | null, attackersScore: number | null): string {
  if (defenderScore == null && attackersScore == null) return 'abandoned';
  const d = defenderScore ?? 0;
  const a = attackersScore ?? 0;
  if (Math.max(d, a) < OUTCOME_EPS) return 'abandoned';
  return d >= a ? 'defender_won' : 'attacker_won';
}

async function syncSovereigntyCampaigns() {
  const startTime = Date.now();
  logger.info('🏰 Starting sovereignty campaigns sync...');

  try {
    const campaigns = await SovereigntyService.getSovereigntyCampaigns();
    logger.info(`📡 Received ${campaigns.length} active campaigns from ESI`);

    const now = new Date();
    let participantCount = 0;
    let startedAlerts = 0;

    // Which of THIS feed's campaigns already exist (scoped to the feed, not the
    // whole history). Anything in the feed but not here is a new campaign. On a
    // first-run/empty table we suppress start alerts — that's a baseline import,
    // not a wave of new wars.
    const esiIds = campaigns.map((c) => c.campaign_id);
    const isBaseline = (await prismaWorker.sovereigntyCampaign.count()) === 0;
    const existingIds = new Set(
      esiIds.length > 0
        ? (
          await prismaWorker.sovereigntyCampaign.findMany({
            where: { campaign_id: { in: esiIds } },
            select: { campaign_id: true },
          })
        ).map((c) => c.campaign_id)
        : []
    );

    for (const campaign of campaigns) {
      // Upsert the campaign itself
      await prismaWorker.sovereigntyCampaign.upsert({
        where: { campaign_id: campaign.campaign_id },
        create: {
          campaign_id: campaign.campaign_id,
          constellation_id: campaign.constellation_id,
          solar_system_id: campaign.solar_system_id,
          structure_id: BigInt(campaign.structure_id),
          event_type: campaign.event_type,
          defender_id: campaign.defender_id ?? null,
          defender_score: campaign.defender_score ?? null,
          attackers_score: campaign.attackers_score ?? null,
          start_time: new Date(campaign.start_time),
        },
        update: {
          defender_id: campaign.defender_id ?? null,
          defender_score: campaign.defender_score ?? null,
          attackers_score: campaign.attackers_score ?? null,
          end_time: null, // still active — clear any previous end marker
          outcome: null, // re-contested: clear any decided outcome from a prior end
        },
      });

      // Upsert participants (guard: ESI omits the field when there are none)
      const participants = campaign.participants ?? [];
      for (const participant of participants) {
        await prismaWorker.campaignParticipant.upsert({
          where: {
            campaign_id_alliance_id: {
              campaign_id: campaign.campaign_id,
              alliance_id: participant.alliance_id,
            },
          },
          create: {
            campaign_id: campaign.campaign_id,
            alliance_id: participant.alliance_id,
            score: participant.score,
          },
          update: { score: participant.score },
        });
        participantCount++;
      }

      // Alert on a genuinely new campaign (in the feed but not previously stored),
      // skipping the first-run baseline and capping per run.
      if (!isBaseline && !existingIds.has(campaign.campaign_id) && startedAlerts < MAX_ALERTS) {
        startedAlerts++;
        const alert = await buildSovereigntyAlert(prismaWorker, {
          type: 'campaign_started',
          systemId: campaign.solar_system_id,
          defenderId: campaign.defender_id ?? null,
        });
        pubsub.publish('SOVEREIGNTY_ALERT', alert);
      }
    }

    // Mark campaigns that are no longer active as ended, inferring an outcome
    // from each campaign's last-known scores. Guard: if ESI returned zero
    // campaigns (likely a transient/empty response) skip end-marking, so a bad
    // poll can't mass-end every active war at once.
    let endedCount = 0;
    if (campaigns.length === 0) {
      logger.warn('⚠️  ESI returned 0 active campaigns — skipping end-marking this run');
    } else {
      const activeIds = campaigns.map((c) => c.campaign_id);
      const departing = await prismaWorker.sovereigntyCampaign.findMany({
        where: { end_time: null, campaign_id: { notIn: activeIds } },
        select: {
          campaign_id: true,
          solar_system_id: true,
          defender_id: true,
          defender_score: true,
          attackers_score: true,
        },
      });
      // Per-row updates are wrapped individually so one failing row doesn't
      // strand the campaigns after it (they'd otherwise stay end_time=null and
      // keep showing as active wars).
      for (const c of departing) {
        try {
          const outcome = inferOutcome(c.defender_score, c.attackers_score);
          await prismaWorker.sovereigntyCampaign.update({
            where: { campaign_id: c.campaign_id },
            data: { end_time: now, outcome },
          });
          endedCount++;
          const alert = await buildSovereigntyAlert(prismaWorker, {
            type: 'campaign_ended',
            systemId: c.solar_system_id,
            defenderId: c.defender_id,
            outcome,
          });
          pubsub.publish('SOVEREIGNTY_ALERT', alert);
        } catch (err) {
          logger.error(`Failed to end campaign ${c.campaign_id}`, { err });
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(
      `✅ Campaigns sync complete: ${campaigns.length} active, ${participantCount} participants, ` +
      `${endedCount} marked ended (${duration}s)`
    );
  } catch (error) {
    logger.error('❌ Sovereignty campaigns sync failed', { error });
    throw error;
  }
}

syncSovereigntyCampaigns()
  .then(async () => {
    await prismaWorker.$disconnect();
    process.exit(0);
  })
  .catch(async () => {
    await prismaWorker.$disconnect();
    process.exit(1);
  });
