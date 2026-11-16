#!/usr/bin/env node
/**
 * Alliance Snapshot Worker
 *
 * Runs daily and records each alliance's member_count and corporation_count
 * for the current UTC day, one row per alliance per day. The counts come
 * straight from corporations; this script writes nothing but
 * alliance_snapshots (update-alliance-counts owns the alliances columns).
 * Mirrored by backend-rs/workers/worker-alliance-snapshots, same SQL.
 *
 * Usage:
 *   yarn snapshot:alliances
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { utcDay } from '../utils/utc-day';

async function takeAllianceSnapshots() {
  logger.info('📸 alliance snapshot worker started...');

  const startTime = new Date();
  // Passed as a 'YYYY-MM-DD' string and cast in SQL, so neither the machine's
  // nor the database session's time zone can shift the day.
  const date = utcDay(startTime).toISOString().split('T')[0];

  try {
    // One statement, no interactive transaction (Prisma closes those after
    // 5 s): the total and the insert see the same snapshot of the data. An
    // alliance with no corporation is recorded with zeros; one that already
    // has a row for the day keeps it unchanged.
    const [row] = await prismaWorker.$queryRaw<
      { total: bigint; created: bigint }[]
    >`
      WITH inserted AS (
        INSERT INTO alliance_snapshots
          (alliance_id, member_count, corporation_count, snapshot_date)
        SELECT a.id, COALESCE(s.members, 0), COALESCE(s.corps, 0), ${date}::date
        FROM alliances a
        LEFT JOIN (
          SELECT alliance_id, COUNT(*)::int AS corps, SUM(member_count)::int AS members
          FROM corporations
          WHERE alliance_id IS NOT NULL
          GROUP BY alliance_id
        ) s ON s.alliance_id = a.id
        ON CONFLICT (alliance_id, snapshot_date) DO NOTHING
        RETURNING 1
      )
      SELECT (SELECT COUNT(*) FROM alliances) AS total,
             (SELECT COUNT(*) FROM inserted) AS created
    `;
    const total = Number(row.total);
    const created = Number(row.created);

    const duration = ((Date.now() - startTime.getTime()) / 1000).toFixed(2);

    logger.info(`✅ snapshot creation completed!`);
    logger.info(`   • total alliances: ${total}`);
    logger.info(`   • new snapshots: ${created}`);
    logger.info(`   • already existing: ${total - created}`);
    logger.info(`   • duration: ${duration} seconds`);
    logger.info(`   • date: ${date}`);
  } catch (error) {
    logger.error('❌ snapshot creation error:', error);
    throw error;
  } finally {
    await prismaWorker.$disconnect();
  }
}

// Start worker
takeAllianceSnapshots()
  .then(() => {
    logger.info('👋 worker terminated');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('💥 worker error:', error);
    process.exit(1);
  });
