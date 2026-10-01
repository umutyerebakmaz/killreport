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
    logger.info('🚀 starting faction sync...');

    const factions = await FactionService.getFactions();
    logger.info(`✓ fetched ${factions.length} factions from ESI`);

    for (const faction of factions) {
      try {
        const data = {
          name: faction.name,
          description: faction.description,
          corporation_id: faction.corporation_id ?? null,
          militia_corporation_id: faction.militia_corporation_id ?? null,
          solar_system_id: faction.solar_system_id ?? null,
          station_count: faction.station_count ?? null,
          station_system_count: faction.station_system_count ?? null,
        };
        await prismaWorker.faction.upsert({
          where: { id: faction.faction_id },
          create: { id: faction.faction_id, ...data },
          update: data,
        });
        logger.debug(`  ✓ saved: ${faction.name}`);
      } catch (error: any) {
        logger.error(
          `  ❌ error saving faction ${faction.faction_id}:`,
          error.message,
        );
      }
    }

    logger.info(`✅ faction sync completed! total: ${factions.length}`);
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ error fetching factions:', error.message);
    process.exit(1);
  }
}

fetchAndSaveFactions();
