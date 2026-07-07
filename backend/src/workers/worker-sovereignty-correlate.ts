#!/usr/bin/env node
/**
 * Sovereignty Killmail Correlation Worker
 *
 * The flagship feature: links our killmail database to active sovereignty
 * campaigns. For every active campaign it tags killmails that happened in the
 * same system within the campaign's activity window (start - grace .. end/now)
 * with `related_campaign_id` + `is_war_related`, then rolls up per-campaign
 * combat stats (kill count + ISK destroyed) into `campaign_combat_stats`.
 *
 * This is what lets us answer "how much ISK is being destroyed in this war?"
 * and "which kills are part of a sov campaign?" — combining data nobody else
 * has together.
 *
 * Usage:
 *   yarn worker:sov:correlate
 *
 * PM2 Cron:
 *   Runs every 10 minutes via ecosystem.config.js
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';

// Kills up to this long BEFORE a campaign's start_time count as war-related
// (staging / pre-timer fights around the contested structure).
const PRE_GRACE_HOURS = 24;

async function correlateSovereigntyKillmails() {
  const startTime = Date.now();
  const now = new Date();
  logger.info('⚔️  Starting sovereignty killmail correlation...');

  try {
    const campaigns = await prismaWorker.sovereigntyCampaign.findMany({
      where: { end_time: null },
      select: { campaign_id: true, solar_system_id: true, start_time: true, defender_id: true },
    });
    logger.info(`📡 Correlating against ${campaigns.length} active campaigns`);

    let totalTagged = 0;
    let campaignsWithKills = 0;

    for (const campaign of campaigns) {
      const windowStart = new Date(campaign.start_time.getTime() - PRE_GRACE_HOURS * 60 * 60 * 1000);

      // Tag untagged killmails in this campaign's system + time window
      const tagged = await prismaWorker.killmail.updateMany({
        where: {
          solar_system_id: campaign.solar_system_id,
          killmail_time: { gte: windowStart, lte: now },
          related_campaign_id: null,
        },
        data: {
          related_campaign_id: campaign.campaign_id,
          is_war_related: true,
        },
      });
      totalTagged += tagged.count;

      // Roll up combat stats from every killmail tagged to this campaign
      const agg = await prismaWorker.killmail.aggregate({
        where: { related_campaign_id: campaign.campaign_id },
        _count: { _all: true },
        _sum: { total_value: true },
      });

      const warKills = agg._count._all;
      if (warKills === 0) continue;
      campaignsWithKills++;

      const iskDestroyed = agg._sum.total_value ?? 0;

      // Attacker-vs-defender split: a tagged kill is a defender loss when the
      // victim's alliance is the campaign defender; everything else (attacker
      // ships and unaffiliated victims) is an attacker/third-party loss. The
      // attacker side is derived as (total - defender) so the two always sum to
      // the flat totals above.
      let defenderShipsLost = 0;
      let defenderIskLost = 0;
      if (campaign.defender_id != null) {
        const defAgg = await prismaWorker.killmail.aggregate({
          where: {
            related_campaign_id: campaign.campaign_id,
            victim: { alliance_id: campaign.defender_id },
          },
          _count: { _all: true },
          _sum: { total_value: true },
        });
        defenderShipsLost = defAgg._count._all;
        defenderIskLost = defAgg._sum.total_value ?? 0;
      }
      const attackerShipsLost = warKills - defenderShipsLost;
      const attackerIskLost = iskDestroyed - defenderIskLost;

      const stats = {
        war_kills: warKills,
        isk_destroyed: iskDestroyed,
        ships_destroyed: warKills,
        defender_isk_lost: defenderIskLost,
        attacker_isk_lost: attackerIskLost,
        defender_ships_lost: defenderShipsLost,
        attacker_ships_lost: attackerShipsLost,
      };
      await prismaWorker.campaignCombatStats.upsert({
        where: { campaign_id: campaign.campaign_id },
        create: { campaign_id: campaign.campaign_id, ...stats },
        update: stats,
      });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(
      `✅ Correlation complete: ${totalTagged} new killmails tagged, ` +
      `${campaignsWithKills}/${campaigns.length} campaigns have war kills (${duration}s)`
    );
  } catch (error) {
    logger.error('❌ Sovereignty correlation failed', { error });
    throw error;
  }
}

correlateSovereigntyKillmails()
  .then(async () => {
    await prismaWorker.$disconnect();
    process.exit(0);
  })
  .catch(async () => {
    await prismaWorker.$disconnect();
    process.exit(1);
  });
