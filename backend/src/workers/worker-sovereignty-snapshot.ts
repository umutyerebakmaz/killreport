#!/usr/bin/env node
/**
 * Sovereignty Daily Snapshot Worker
 *
 * Writes a daily point-in-time snapshot of the current sovereignty map and
 * aggregates per-alliance territory statistics for the day:
 *   - systems_controlled, ihub_count, tcu_count
 *   - campaigns_attacking / campaigns_defending (from active campaigns)
 *   - systems_gained / systems_lost (from today's territory_changes)
 *
 * Idempotent: uses (system, date) and (alliance, date) unique keys, so re-running
 * on the same day overwrites/skips rather than duplicating.
 *
 * Usage:
 *   yarn worker:sov:snapshot
 *
 * PM2 Cron:
 *   Runs daily at 01:00 UTC via ecosystem.config.js
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';

const IHUB_TYPE_ID = 32458; // Infrastructure Hub
const TCU_TYPE_ID = 32226; // Territorial Claim Unit
const BATCH_SIZE = 1000;

type StatRow = {
  systems_controlled: number;
  ihub_count: number;
  tcu_count: number;
  campaigns_attacking: number;
  campaigns_defending: number;
  systems_gained: number;
  systems_lost: number;
};

function emptyRow(): StatRow {
  return {
    systems_controlled: 0,
    ihub_count: 0,
    tcu_count: 0,
    campaigns_attacking: 0,
    campaigns_defending: 0,
    systems_gained: 0,
    systems_lost: 0,
  };
}

async function snapshotSovereignty() {
  const startTime = Date.now();
  const now = new Date();
  const snapshotDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  logger.info(`📸 Starting sovereignty daily snapshot for ${snapshotDate.toISOString().slice(0, 10)}...`);

  try {
    // 1. Snapshot the current map
    const current = await prismaWorker.sovereigntyMapCurrent.findMany();
    logger.info(`   • Snapshotting ${current.length} owned systems`);

    let snapshotInserted = 0;
    for (let i = 0; i < current.length; i += BATCH_SIZE) {
      const batch = current.slice(i, i + BATCH_SIZE).map((r) => ({
        solar_system_id: r.solar_system_id,
        alliance_id: r.alliance_id,
        corporation_id: r.corporation_id,
        faction_id: r.faction_id,
        snapshot_date: snapshotDate,
      }));
      const res = await prismaWorker.sovereigntyMapSnapshot.createMany({
        data: batch,
        skipDuplicates: true,
      });
      snapshotInserted += res.count;
    }

    // 2. Aggregate per-alliance territory stats
    const stats = new Map<number, StatRow>();
    const rowFor = (allianceId: number) => {
      let row = stats.get(allianceId);
      if (!row) {
        row = emptyRow();
        stats.set(allianceId, row);
      }
      return row;
    };

    // systems controlled
    const systemsByAlliance = await prismaWorker.sovereigntyMapCurrent.groupBy({
      by: ['alliance_id'],
      where: { alliance_id: { not: null } },
      _count: { _all: true },
    });
    for (const g of systemsByAlliance) {
      if (g.alliance_id != null) rowFor(g.alliance_id).systems_controlled = g._count._all;
    }

    // structure counts (IHub / TCU), only live structures
    const structuresByAlliance = await prismaWorker.sovereigntyStructure.groupBy({
      by: ['alliance_id', 'structure_type_id'],
      where: { destroyed_at: null },
      _count: { _all: true },
    });
    for (const g of structuresByAlliance) {
      const row = rowFor(g.alliance_id);
      if (g.structure_type_id === IHUB_TYPE_ID) row.ihub_count = g._count._all;
      else if (g.structure_type_id === TCU_TYPE_ID) row.tcu_count = g._count._all;
    }

    // campaigns defending (active campaigns where alliance is the defender)
    const defending = await prismaWorker.sovereigntyCampaign.groupBy({
      by: ['defender_id'],
      where: { end_time: null, defender_id: { not: null } },
      _count: { _all: true },
    });
    for (const g of defending) {
      if (g.defender_id != null) rowFor(g.defender_id).campaigns_defending = g._count._all;
    }

    // campaigns attacking (active campaigns, participants other than the defender)
    const activeCampaigns = await prismaWorker.sovereigntyCampaign.findMany({
      where: { end_time: null },
      select: { defender_id: true, participants: { select: { alliance_id: true } } },
    });
    for (const campaign of activeCampaigns) {
      for (const p of campaign.participants) {
        if (p.alliance_id !== campaign.defender_id) rowFor(p.alliance_id).campaigns_attacking += 1;
      }
    }

    // systems gained / lost today (from territory_changes)
    const gained = await prismaWorker.territoryChange.groupBy({
      by: ['new_owner_id'],
      where: { detected_at: { gte: snapshotDate }, new_owner_id: { not: null } },
      _count: { _all: true },
    });
    for (const g of gained) {
      if (g.new_owner_id != null) rowFor(g.new_owner_id).systems_gained = g._count._all;
    }
    const lost = await prismaWorker.territoryChange.groupBy({
      by: ['previous_owner_id'],
      where: { detected_at: { gte: snapshotDate }, previous_owner_id: { not: null } },
      _count: { _all: true },
    });
    for (const g of lost) {
      if (g.previous_owner_id != null) rowFor(g.previous_owner_id).systems_lost = g._count._all;
    }

    // 3. Upsert per-alliance stats
    let statsUpserted = 0;
    for (const [allianceId, row] of stats) {
      await prismaWorker.allianceTerritoryStats.upsert({
        where: { alliance_id_date: { alliance_id: allianceId, date: snapshotDate } },
        create: { alliance_id: allianceId, date: snapshotDate, ...row },
        update: { ...row },
      });
      statsUpserted++;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(
      `✅ Snapshot complete: ${snapshotInserted} map rows snapshotted, ` +
      `${statsUpserted} alliance stat rows written (${duration}s)`
    );
  } catch (error) {
    logger.error('❌ Sovereignty snapshot failed', { error });
    throw error;
  }
}

snapshotSovereignty()
  .then(async () => {
    await prismaWorker.$disconnect();
    process.exit(0);
  })
  .catch(async () => {
    await prismaWorker.$disconnect();
    process.exit(1);
  });
