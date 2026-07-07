#!/usr/bin/env node
/**
 * Sovereignty Structures Worker
 *
 * Polls ESI `/sovereignty/structures` and upserts every sovereignty structure
 * (IHubs / TCUs) with its current owner and vulnerability window. Structures
 * that were present in a previous run but are no longer returned by ESI are
 * marked as destroyed (destroyed_at set to now).
 *
 * Usage:
 *   yarn worker:sov:structures
 *
 * PM2 Cron:
 *   Runs every 30 minutes via ecosystem.config.js
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { SovereigntyService } from '@services/sovereignty/sovereignty.service';

const CHUNK_SIZE = 50;

async function syncSovereigntyStructures() {
  const startTime = Date.now();
  logger.info('🛰️  Starting sovereignty structures sync...');

  try {
    const structures = await SovereigntyService.getSovereigntyStructures();
    logger.info(`📡 Received ${structures.length} structures from ESI`);

    const now = new Date();
    let upserted = 0;

    for (let i = 0; i < structures.length; i += CHUNK_SIZE) {
      const chunk = structures.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map((s) =>
          prismaWorker.sovereigntyStructure.upsert({
            where: { structure_id: BigInt(s.structure_id) },
            create: {
              structure_id: BigInt(s.structure_id),
              solar_system_id: s.solar_system_id,
              structure_type_id: s.structure_type_id,
              alliance_id: s.alliance_id,
              vulnerability_occupancy_level: s.vulnerability_occupancy_level ?? null,
              vulnerable_start_time: s.vulnerable_start_time ? new Date(s.vulnerable_start_time) : null,
              vulnerable_end_time: s.vulnerable_end_time ? new Date(s.vulnerable_end_time) : null,
            },
            update: {
              alliance_id: s.alliance_id,
              vulnerability_occupancy_level: s.vulnerability_occupancy_level ?? null,
              vulnerable_start_time: s.vulnerable_start_time ? new Date(s.vulnerable_start_time) : null,
              vulnerable_end_time: s.vulnerable_end_time ? new Date(s.vulnerable_end_time) : null,
              destroyed_at: null, // seen again — clear any previous destroyed marker
            },
          })
        )
      );
      upserted += chunk.length;
    }

    // Mark structures no longer present as destroyed
    const activeIds = structures.map((s) => BigInt(s.structure_id));
    const destroyed = await prismaWorker.sovereigntyStructure.updateMany({
      where: {
        destroyed_at: null,
        structure_id: { notIn: activeIds.length > 0 ? activeIds : [BigInt(-1)] },
      },
      data: { destroyed_at: now },
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(
      `✅ Structures sync complete: ${upserted} upserted, ${destroyed.count} marked destroyed (${duration}s)`
    );
  } catch (error) {
    logger.error('❌ Sovereignty structures sync failed', { error });
    throw error;
  }
}

syncSovereigntyStructures()
  .then(async () => {
    await prismaWorker.$disconnect();
    process.exit(0);
  })
  .catch(async () => {
    await prismaWorker.$disconnect();
    process.exit(1);
  });
