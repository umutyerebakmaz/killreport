#!/usr/bin/env node
/**
 * Sovereignty Daily Snapshot Worker
 *
 * Writes the previous UTC day's close: one `sovereignty_map_snapshots` row per
 * owned system and one `alliance_territory_stats` row per alliance, both dated
 * that day (D). The systemd timer fires at 01:00 UTC, so map, structure and
 * campaign counts are those of 01:00, and systems_gained / systems_lost count
 * the whole of D, `[D 00:00, D+1 00:00)`.
 *
 * D is deleted and rewritten in one transaction, so a re-run leaves exactly
 * the latest state. An empty current map writes nothing. The Rust
 * counterpart, `backend-rs/workers/worker-sovereignty-snapshot`, runs the same
 * four statements.
 *
 * Usage:
 *   yarn worker:sov:snapshot
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';

/**
 * The day a run writes, as 'YYYY-MM-DD': the UTC day before `now`. Bound as a
 * string, not a Date, so the `::date` cast never sees a session time zone.
 */
export function snapshotDateFor(now: Date): string {
  const day = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  );
  return day.toISOString().slice(0, 10);
}

export async function snapshotSovereignty(now: Date = new Date()) {
  const startTime = Date.now();
  const date = snapshotDateFor(now);
  logger.info(`📸 starting sovereignty daily snapshot for ${date}...`);

  try {
    const result = await prismaWorker.$transaction(async (tx) => {
      const [{ empty }] = await tx.$queryRaw<{ empty: boolean }[]>`
        SELECT NOT EXISTS (SELECT 1 FROM sovereignty_map_current) AS empty`;
      if (empty) return null;

      await tx.$executeRaw`
        DELETE FROM sovereignty_map_snapshots WHERE snapshot_date = ${date}::date`;
      const mapRows = await tx.$executeRaw`
        INSERT INTO sovereignty_map_snapshots
          (solar_system_id, alliance_id, corporation_id, faction_id, snapshot_date)
        SELECT solar_system_id, alliance_id, corporation_id, faction_id, ${date}::date
        FROM sovereignty_map_current`;
      await tx.$executeRaw`
        DELETE FROM alliance_territory_stats WHERE date = ${date}::date`;
      // IHub 32458, TCU 32226. An attacker is every participant of an open
      // campaign other than its defender (all of them when it is NULL).
      const statRows = await tx.$executeRaw`
        WITH
          systems AS (
            SELECT alliance_id, COUNT(*)::int AS n FROM sovereignty_map_current
            WHERE alliance_id IS NOT NULL GROUP BY alliance_id),
          ihubs AS (
            SELECT alliance_id, COUNT(*)::int AS n FROM sovereignty_structures
            WHERE destroyed_at IS NULL AND structure_type_id = 32458 GROUP BY alliance_id),
          tcus AS (
            SELECT alliance_id, COUNT(*)::int AS n FROM sovereignty_structures
            WHERE destroyed_at IS NULL AND structure_type_id = 32226 GROUP BY alliance_id),
          defending AS (
            SELECT defender_id AS alliance_id, COUNT(*)::int AS n FROM sovereignty_campaigns
            WHERE end_time IS NULL AND defender_id IS NOT NULL GROUP BY defender_id),
          attacking AS (
            SELECT p.alliance_id, COUNT(*)::int AS n
            FROM sovereignty_campaigns c
            JOIN campaign_participants p ON p.campaign_id = c.campaign_id
            WHERE c.end_time IS NULL AND p.alliance_id IS DISTINCT FROM c.defender_id
            GROUP BY p.alliance_id),
          gained AS (
            SELECT new_owner_id AS alliance_id, COUNT(*)::int AS n FROM territory_changes
            WHERE new_owner_id IS NOT NULL
              AND detected_at >= ${date}::date AND detected_at < ${date}::date + 1
            GROUP BY new_owner_id),
          lost AS (
            SELECT previous_owner_id AS alliance_id, COUNT(*)::int AS n FROM territory_changes
            WHERE previous_owner_id IS NOT NULL
              AND detected_at >= ${date}::date AND detected_at < ${date}::date + 1
            GROUP BY previous_owner_id),
          ids AS (
            SELECT alliance_id FROM systems UNION SELECT alliance_id FROM ihubs
            UNION SELECT alliance_id FROM tcus UNION SELECT alliance_id FROM defending
            UNION SELECT alliance_id FROM attacking UNION SELECT alliance_id FROM gained
            UNION SELECT alliance_id FROM lost)
        INSERT INTO alliance_territory_stats
          (alliance_id, date, systems_controlled, ihub_count, tcu_count,
           campaigns_attacking, campaigns_defending, systems_gained, systems_lost)
        SELECT ids.alliance_id, ${date}::date,
          COALESCE(systems.n, 0), COALESCE(ihubs.n, 0), COALESCE(tcus.n, 0),
          COALESCE(attacking.n, 0), COALESCE(defending.n, 0),
          COALESCE(gained.n, 0), COALESCE(lost.n, 0)
        FROM ids
        LEFT JOIN systems USING (alliance_id) LEFT JOIN ihubs USING (alliance_id)
        LEFT JOIN tcus USING (alliance_id) LEFT JOIN defending USING (alliance_id)
        LEFT JOIN attacking USING (alliance_id) LEFT JOIN gained USING (alliance_id)
        LEFT JOIN lost USING (alliance_id)`;
      return { mapRows, statRows };
    });

    if (!result) {
      logger.warn('⚠️  sovereignty_map_current is empty — skipping this run');
      return;
    }
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(
      `✅ snapshot complete: ${result.mapRows} map rows snapshotted, ` +
        `${result.statRows} alliance stat rows written (${duration}s)`,
    );
  } catch (error) {
    logger.error('❌ sovereignty snapshot failed', { error });
    throw error;
  }
}

// Run only when executed directly, so the spec can import the snapshot
if (require.main === module) {
  snapshotSovereignty()
    .then(async () => {
      await prismaWorker.$disconnect();
      process.exit(0);
    })
    .catch(async () => {
      await prismaWorker.$disconnect();
      process.exit(1);
    });
}
