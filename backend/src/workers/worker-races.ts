/**
 * Race Worker - fetches race info from ESI and saves it to the database
 *
 * Fetches every race in EVE Online.
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { RaceService } from '@services/race/race.service';

async function fetchAndSaveRaces() {
  try {
    logger.info('🚀 starting race sync...');

    const races = await RaceService.getRaces();
    logger.info(`✓ fetched ${races.length} races from ESI`);

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
        logger.debug(`  ✓ saved: ${race.name}`);
      } catch (error: any) {
        logger.error(`  ❌ error saving race ${race.race_id}:`, error.message);
      }
    }

    logger.info(`✅ race sync completed! total: ${races.length}`);
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ error fetching races:', error.message);
    process.exit(1);
  }
}

fetchAndSaveRaces();
