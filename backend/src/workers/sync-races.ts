/**
 * Race Info Worker - ESI'den race bilgilerini çeker ve veritabanına kaydeder
 *
 * ESI endpoint: https://esi.evetech.net/latest/universe/races/
 *
 * Bu worker EVE Online'daki tüm ırkların bilgilerini çeker.
 */

import axios from 'axios';
import prisma from '../services/prisma';

interface ESIRace {
    race_id: number;
    name: string;
    description: string;
}

async function fetchAndSaveRaces() {
    try {
        console.log('🚀 Starting race sync...');

        const response = await axios.get<ESIRace[]>(
            'https://esi.evetech.net/latest/universe/races/'
        );

        const races = response.data;
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
