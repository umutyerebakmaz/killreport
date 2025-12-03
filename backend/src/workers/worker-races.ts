/**
 * Race Worker - ESI'den race bilgilerini çeker ve veritabanına kaydeder
 *
 * Bu worker EVE Online'daki tüm ırkların bilgilerini çeker.
 */

import prisma from '../services/prisma';
import { RaceService } from '../services/race/race.service';

async function fetchAndSaveRaces() {
    try {
        console.log('🚀 Starting race sync...');

        const races = await RaceService.getRaces();
        console.log(`✓ Fetched ${races.length} races from ESI`);

        for (const race of races) {
            try {
                await prisma.race.upsert({
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
                console.log(`  ✓ Saved: ${race.name}`);
            } catch (error: any) {
                console.error(`  ❌ Error saving race ${race.race_id}:`, error.message);
            }
        }

        console.log(`✅ Race sync completed! Total: ${races.length}`);
        process.exit(0);
    } catch (error: any) {
        console.error('❌ Error fetching races:', error.message);
        process.exit(1);
    }
}

fetchAndSaveRaces();
