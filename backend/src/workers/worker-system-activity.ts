#!/usr/bin/env node
/**
 * System Activity Snapshot Worker
 *
 * Collects one hourly snapshot of per-system activity from ESI and stores it in
 * the system_activity table for historical tracking and graphing:
 * - ship_kills, pod_kills, npc_kills: GET /universe/system_kills
 * - ship_jumps:                       GET /universe/system_jumps
 *
 * Two requests, one row per system per hour. The two endpoints publish on the
 * same hourly cadence, so the pair is one snapshot of the same instant; they do
 * NOT cover the same set of systems, and `mergeSystemActivity` is where that is
 * resolved — see utils/system-activity.ts for what a gap in either list means.
 *
 * Usage:
 *   yarn worker:system-activity
 *
 * PM2 Cron:
 *   Runs every hour automatically via ecosystem.config.js
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { SolarSystemService } from '@services/solar-system/solar-system.service';
import {
  hourSnapshotTime,
  mergeSystemActivity,
  type EsiSystemJumps,
  type EsiSystemKills,
} from '../utils/system-activity';

async function snapshotSystemActivity() {
  const startTime = Date.now();
  const snapshotTime = hourSnapshotTime(new Date());

  logger.info('📸 Starting system activity snapshot collection...');
  logger.info(`   • Snapshot time: ${snapshotTime.toISOString()}`);

  try {
    // Both requests together: one row carries both halves, so there is nothing
    // to gain by serialising them. `esiRateLimiter` governs the dispatch.
    logger.info('📡 Fetching system kills and jumps from ESI...');
    const [killData, jumpData]: [EsiSystemKills[], EsiSystemJumps[]] =
      await Promise.all([
        SolarSystemService.getSystemKills(),
        SolarSystemService.getSystemJumps(),
      ]);

    // A failed request throws and this run writes nothing. A run that wrote
    // only the half that arrived would record the other half as "not reported"
    // for that hour, and the hour would never be revisited: the snapshot is
    // keyed on (system_id, timestamp) and the next run carries the next hour.
    const kills = killData ?? [];
    const jumps = jumpData ?? [];

    if (kills.length === 0 && jumps.length === 0) {
      logger.warn('⚠️  No activity data returned from ESI');
      return;
    }

    logger.info(
      `✓ Received kills for ${kills.length} systems, jumps for ${jumps.length}`,
    );

    const snapshotRecords = mergeSystemActivity(kills, jumps, snapshotTime);

    // Calculate statistics
    const totalShipKills = kills.reduce((sum, s) => sum + s.ship_kills, 0);
    const totalPodKills = kills.reduce((sum, s) => sum + s.pod_kills, 0);
    const totalNpcKills = kills.reduce((sum, s) => sum + s.npc_kills, 0);
    const totalShipJumps = jumps.reduce((sum, s) => sum + s.ship_jumps, 0);

    logger.info(`📊 Activity Statistics:`);
    logger.info(`   • Total ship kills: ${totalShipKills.toLocaleString()}`);
    logger.info(`   • Total pod kills: ${totalPodKills.toLocaleString()}`);
    logger.info(`   • Total NPC kills: ${totalNpcKills.toLocaleString()}`);
    logger.info(`   • Total ship jumps: ${totalShipJumps.toLocaleString()}`);
    logger.info(
      `   • Rows to write: ${snapshotRecords.length.toLocaleString()}`,
    );

    // Insert snapshots in batches
    let inserted = 0;
    const BATCH_SIZE = 1000;

    logger.info('💾 Saving snapshots to database...');

    for (let i = 0; i < snapshotRecords.length; i += BATCH_SIZE) {
      const batch = snapshotRecords.slice(i, i + BATCH_SIZE);

      // Use skipDuplicates to handle any race conditions
      const result = await prismaWorker.systemActivity.createMany({
        data: batch,
        skipDuplicates: true,
      });

      inserted += result.count;

      if (
        (i + BATCH_SIZE) % 5000 === 0 ||
        i + BATCH_SIZE >= snapshotRecords.length
      ) {
        logger.info(
          `  ⏳ Progress: ${Math.min(i + BATCH_SIZE, snapshotRecords.length)}/${
            snapshotRecords.length
          } snapshots processed`,
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
    logger.error('❌ System activity snapshot failed', { error });
    throw error;
  }
}

// Run the snapshot collection
snapshotSystemActivity()
  .then(() => {
    logger.info('👋 Snapshot worker finished');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('💥 Snapshot worker error', { error });
    process.exit(1);
  });
