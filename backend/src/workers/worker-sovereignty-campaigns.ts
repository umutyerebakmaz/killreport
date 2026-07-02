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
import { SovereigntyService } from '@services/sovereignty/sovereignty.service';

async function syncSovereigntyCampaigns() {
  const startTime = Date.now();
  logger.info('🏰 Starting sovereignty campaigns sync...');

  try {
    const campaigns = await SovereigntyService.getSovereigntyCampaigns();
    logger.info(`📡 Received ${campaigns.length} active campaigns from ESI`);

    const now = new Date();
    let participantCount = 0;

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
    }

    // Mark campaigns that are no longer active as ended
    const activeIds = campaigns.map((c) => c.campaign_id);
    const ended = await prismaWorker.sovereigntyCampaign.updateMany({
      where: {
        end_time: null,
        campaign_id: { notIn: activeIds.length > 0 ? activeIds : [-1] },
      },
      data: { end_time: now },
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(
      `✅ Campaigns sync complete: ${campaigns.length} active, ${participantCount} participants, ` +
      `${ended.count} marked ended (${duration}s)`
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
