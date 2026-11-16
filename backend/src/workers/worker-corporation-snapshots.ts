#!/usr/bin/env node
/**
 * Corporation Snapshot Worker
 *
 * Runs daily and records each corporation's member_count for the current UTC
 * day, one row per corporation per day.
 * Mirrored by backend-rs/workers/worker-corporation-snapshots, same SQL.
 *
 * Usage:
 *   yarn snapshot:corporations
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { utcDay } from '../utils/utc-day';

async function takeCorporationSnapshots() {
  logger.info('📸 corporation snapshot worker started...');

  const startTime = new Date();
  // Passed as a 'YYYY-MM-DD' string and cast in SQL, so neither the machine's
  // nor the database session's time zone can shift the day.
  const date = utcDay(startTime).toISOString().split('T')[0];

  try {
    const { total, created } = await prismaWorker.$transaction(async (tx) => {
      const [{ count }] = await tx.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) AS count FROM corporations
      `;
      // A corporation that already has a row for the day keeps it unchanged.
      const inserted = await tx.$executeRaw`
        INSERT INTO corporation_snapshots (corporation_id, member_count, snapshot_date)
        SELECT id, member_count, ${date}::date FROM corporations
        ON CONFLICT (corporation_id, snapshot_date) DO NOTHING
      `;
      return { total: Number(count), created: inserted };
    });

    const duration = ((Date.now() - startTime.getTime()) / 1000).toFixed(2);

    logger.info(`✅ snapshot creation completed!`);
    logger.info(`   • total corporations: ${total}`);
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
takeCorporationSnapshots()
  .then(() => {
    logger.info('👋 worker terminated');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('💥 worker error:', error);
    process.exit(1);
  });
