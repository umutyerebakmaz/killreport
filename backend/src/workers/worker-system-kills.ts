#!/usr/bin/env node
/**
 * System Kills Snapshot Worker
 *
 * Collects hourly snapshot of kill statistics for all solar systems from ESI
 * and stores them in the system_kills table for historical tracking and graphing.
 * Returns:
 * - system_id: Solar system ID
 * - npc_kills: Number of NPC ships killed in the last hour
 * - pod_kills: Number of pods killed in the last hour
 * - ship_kills: Number of player ships killed in the last hour
 *
 * Usage:
 *   yarn worker:system-kills
 *
 * PM2 Cron:
 *   Runs every hour automatically via ecosystem.config.js
 */

import logger from '@services/logger';
import prisma from '@services/prisma';
import { SolarSystemService } from '@services/solar-system/solar-system.service';

interface SystemKillData {
  system_id: number;
  npc_kills: number;
  pod_kills: number;
  ship_kills: number;
}

async function snapshotSystemKills() {
  const startTime = Date.now();
  const snapshotTime = new Date();
  // Round down to the hour for consistency
  snapshotTime.setMinutes(0, 0, 0);

  logger.info('📸 Starting system kills snapshot collection...');
  logger.info(`   • Snapshot time: ${snapshotTime.toISOString()}`);

  try {
    // Fetch kill data from ESI
    logger.info('📡 Fetching system kills from ESI...');
    const killData: SystemKillData[] = await SolarSystemService.getSystemKills();

    if (!killData || killData.length === 0) {
      logger.warn('⚠️  No kill data returned from ESI');
      return;
    }

    logger.info(`✓ Received kill data for ${killData.length} systems with activity`);

    // Calculate statistics
    const totalShipKills = killData.reduce((sum, s) => sum + s.ship_kills, 0);
    const totalPodKills = killData.reduce((sum, s) => sum + s.pod_kills, 0);
    const totalNpcKills = killData.reduce((sum, s) => sum + s.npc_kills, 0);

    logger.info(`📊 Activity Statistics:`);
    logger.info(`   • Total ship kills: ${totalShipKills.toLocaleString()}`);
    logger.info(`   • Total pod kills: ${totalPodKills.toLocaleString()}`);
    logger.info(`   • Total NPC kills: ${totalNpcKills.toLocaleString()}`);

    // Prepare snapshot records
    const snapshotRecords = killData.map((system) => ({
      system_id: system.system_id,
      npc_kills: system.npc_kills,
      pod_kills: system.pod_kills,
      ship_kills: system.ship_kills,
      timestamp: snapshotTime,
    }));

    // Insert snapshots in batches
    let inserted = 0;
    const BATCH_SIZE = 1000;

    logger.info('💾 Saving snapshots to database...');

    for (let i = 0; i < snapshotRecords.length; i += BATCH_SIZE) {
      const batch = snapshotRecords.slice(i, i + BATCH_SIZE);

      // Use skipDuplicates to handle any race conditions
      const result = await prisma.systemKills.createMany({
        data: batch,
        skipDuplicates: true,
      });

      inserted += result.count;

      if ((i + BATCH_SIZE) % 5000 === 0 || i + BATCH_SIZE >= snapshotRecords.length) {
        logger.info(
          `  ⏳ Progress: ${Math.min(i + BATCH_SIZE, snapshotRecords.length)}/${snapshotRecords.length
          } snapshots processed`
        );
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    logger.info(`✅ Snapshot collection completed successfully!`);
    logger.info(`   • Snapshots saved: ${inserted.toLocaleString()}`);
    logger.info(`   • Snapshot timestamp: ${snapshotTime.toISOString()}`);
    logger.info(`   • Duration: ${duration} seconds`);
    logger.info(`   • Next snapshot: in 1 hour`);
  } catch (error) {
    logger.error('❌ System kills snapshot failed', { error });
    throw error;
  }
}

// Run the snapshot collection
snapshotSystemKills()
  .then(() => {
    logger.info('👋 Snapshot worker finished');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('💥 Snapshot worker error', { error });
    process.exit(1);
  });
