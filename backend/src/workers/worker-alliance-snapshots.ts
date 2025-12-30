#!/usr/bin/env node
/**
 * Alliance Snapshot Worker
 *
 * This worker should run daily (via cron job) and records the current
 * member_count and corporation_count values for all alliances as snapshots.
 *
 * Usage:
 *   yarn snapshot:alliances
 *
 * Cron example (every day at midnight):
 *   0 0 * * * cd /root/killreport/backend && yarn snapshot:alliances
 */

import logger from '../services/logger';
import prismaWorker from '../services/prisma-worker';

async function takeAllianceSnapshots() {
  logger.info('📸 Alliance Snapshot Worker started...');

  const startTime = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of day

  try {
    // Get all alliances
    const alliances = await prismaWorker.alliance.findMany({
      select: { id: true },
    });

    logger.info(`✓ Found ${alliances.length} alliances`);

    let processed = 0;
    let created = 0;
    let skipped = 0;

    for (const alliance of alliances) {
      // Check if snapshot for today already exists for this alliance
      const existingSnapshot = await prismaWorker.allianceSnapshot.findFirst({
        where: {
          alliance_id: alliance.id,
          snapshot_date: today,
        },
      });

      if (existingSnapshot) {
        skipped++;
        processed++;
        continue;
      }

      // Calculate current values
      const corporationCount = await prismaWorker.corporation.count({
        where: { alliance_id: alliance.id },
      });

      const memberResult = await prismaWorker.corporation.aggregate({
        where: { alliance_id: alliance.id },
        _sum: {
          member_count: true,
        },
      });

      const memberCount = memberResult._sum.member_count || 0;

      // Create snapshot
      await prismaWorker.allianceSnapshot.create({
        data: {
          alliance_id: alliance.id,
          member_count: memberCount,
          corporation_count: corporationCount,
          snapshot_date: today,
        },
      });

      // Update alliance table with current counts
      await prismaWorker.alliance.update({
        where: { id: alliance.id },
        data: {
          member_count: memberCount,
          corporation_count: corporationCount,
        },
      });

      created++;
      processed++;

      // Show progress every 50 alliances
      if (processed % 50 === 0) {
        logger.debug(`  ⏳ Processed: ${processed}/${alliances.length} (${created} new, ${skipped} existing)`);
      }
    }

    const endTime = new Date();
    const duration = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2);

    logger.info(`✅ Snapshot creation completed!`);
    logger.info(`   • Total processed: ${processed}`);
    logger.info(`   • New snapshots: ${created}`);
    logger.info(`   • Already existing: ${skipped}`);
    logger.info(`   • Duration: ${duration} seconds`);
    logger.info(`   • Date: ${today.toISOString().split('T')[0]}`);

  } catch (error) {
    logger.error('❌ Snapshot creation error:', error);
    throw error;
  } finally {
    await prismaWorker.$disconnect();
  }
}

// Start worker
takeAllianceSnapshots()
  .then(() => {
    logger.info('👋 Worker terminated');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('💥 Worker error:', error);
    process.exit(1);
  });
