/**
 * Race Worker - ESI'den race bilgilerini çeker ve veritabanına kaydeder
 *
 * Bu worker EVE Online'daki tüm ırkların bilgilerini çeker.
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { RaceService } from '@services/race/race.service';

async function fetchAndSaveRaces() {
  try {
    logger.info('🚀 Starting race sync...');

    const races = await RaceService.getRaces();
    logger.info(`✓ Fetched ${races.length} races from ESI`);

    for (const race of races) {
      try {
        await prismaWorker.race.upsert({
          where: { id: race.race_id },
          create: {
            id: race.race_id,
            name: race.name,
            description: race.description,
          },
          update: {
            name: race.name,
            description: race.description,
          },
        });
        logger.debug(`  ✓ Saved: ${race.name}`);
      } catch (error: any) {
        logger.error(`  ❌ Error saving race ${race.race_id}:`, error.message);
      }
    }

    logger.info(`✅ Race sync completed! Total: ${races.length}`);
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Error fetching races:', error.message);
    process.exit(1);
  }
}

fetchAndSaveRaces();
