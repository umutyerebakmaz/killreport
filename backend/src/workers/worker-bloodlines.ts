/**
 * Bloodline Info Worker - ESI'den bloodline bilgilerini çeker ve veritabanına kaydeder
 *
 * ESI endpoint: https://esi.evetech.net/latest/universe/bloodlines/
 *
 * Bu worker EVE Online'daki tüm bloodline'ların bilgilerini çeker.
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import axios from 'axios';

interface ESIBloodline {
  bloodline_id: number;
  name: string;
  description: string;
  race_id: number;
}

async function fetchAndSaveBloodlines() {
  try {
    logger.info('🚀 Starting bloodline sync...');

    const response = await axios.get<ESIBloodline[]>(
      'https://esi.evetech.net/latest/universe/bloodlines/'
    );

    const bloodlines = response.data;
    logger.info(`✓ Fetched ${bloodlines.length} bloodlines from ESI`);

    for (const bloodline of bloodlines) {
      try {
        await prismaWorker.bloodline.upsert({
          where: { id: bloodline.bloodline_id },
          create: {
            id: bloodline.bloodline_id,
            name: bloodline.name,
            description: bloodline.description,
            race_id: bloodline.race_id,
          },
          update: {
            name: bloodline.name,
            description: bloodline.description,
            race_id: bloodline.race_id,
          },
        });
        logger.debug(`  ✓ Saved: ${bloodline.name}`);
      } catch (error: any) {
        logger.error(`  ❌ Error saving bloodline ${bloodline.bloodline_id}:`, error.message);
      }
    }

    logger.info(`✅ Bloodline sync completed! Total: ${bloodlines.length}`);
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Error fetching bloodlines:', error.message);
    process.exit(1);
  }
}

fetchAndSaveBloodlines();
