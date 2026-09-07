/**
 * Faction Worker — fetches faction information from ESI and saves it.
 *
 * Run by hand, like worker:races and worker:bloodlines. Faction data is static
 * reference data: the list changes only when CCP adds a faction, so it belongs
 * in neither PM2's cron_restart nor the droplet's crontab.
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { FactionService } from '@services/faction/faction.service';

async function fetchAndSaveFactions() {
  try {
    logger.info('🚀 Starting faction sync...');

    const factions = await FactionService.getFactions();
    logger.info(`✓ Fetched ${factions.length} factions from ESI`);

    for (const faction of factions) {
      try {
        await prismaWorker.faction.upsert({
          where: { id: faction.faction_id },
          create: {
            id: faction.faction_id,
            name: faction.name,
            description: faction.description,
            corporation_id: faction.corporation_id ?? null,
            militia_corporation_id: faction.militia_corporation_id ?? null,
          },
          update: {
            name: faction.name,
            description: faction.description,
            corporation_id: faction.corporation_id ?? null,
            militia_corporation_id: faction.militia_corporation_id ?? null,
          },
        });
        logger.debug(`  ✓ Saved: ${faction.name}`);
      } catch (error: any) {
        logger.error(
          `  ❌ Error saving faction ${faction.faction_id}:`,
          error.message,
        );
      }
    }

    logger.info(`✅ Faction sync completed! Total: ${factions.length}`);
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Error fetching factions:', error.message);
    process.exit(1);
  }
}

fetchAndSaveFactions();
