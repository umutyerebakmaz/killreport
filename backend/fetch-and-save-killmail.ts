/**
 * Quick script to fetch and save a specific killmail
 */

import './src/config.js';
import { getKillmailDetail } from './src/services/eve-esi.js';
import prisma from './src/services/prisma.js';

const KILLMAIL_ID = 130966893;

async function fetchAndSaveKillmail() {
    try {
        console.log(`🔍 Fetching killmail ${KILLMAIL_ID} from zKillboard...\n`);

        // Get hash from zKillboard
        const zkillUrl = `https://zkillboard.com/api/killID/${KILLMAIL_ID}/`;
        const response = await fetch(zkillUrl);

        if (!response.ok) {
            console.log(`❌ Failed to fetch from zKillboard: ${response.status}`);
            return;
        }

        const data = await response.json();

        if (!data || data.length === 0) {
            console.log('❌ No data returned from zKillboard');
            return;
        }

        const zkillData = data[0];
        const hash = zkillData.zkb.hash;

        console.log(`✅ Got killmail hash: ${hash}`);
        console.log(`📡 Fetching details from ESI...\n`);

        // Get full details from ESI
        const detail = await getKillmailDetail(KILLMAIL_ID, hash);

        console.log(`✅ Got killmail details`);
        console.log(`   System: ${detail.solar_system_id}`);
        console.log(`   Attackers: ${detail.attackers.length}`);
        console.log(`   Items: ${detail.victim.items?.length || 0}`);
        console.log(`\n💾 Saving to database...\n`);

        // Save to database
        await prisma.$transaction(async (tx) => {
            // 1. Create main killmail record
            await tx.killmail.create({
                data: {
                    killmail_id: KILLMAIL_ID,
                    killmail_hash: hash,
                    killmail_time: new Date(detail.killmail_time),
                    solar_system_id: detail.solar_system_id,
                },
            });

            // 2. Create victim record
            await tx.victim.create({
                data: {
                    killmail_id: KILLMAIL_ID,
                    character_id: detail.victim.character_id,
                    corporation_id: detail.victim.corporation_id,
                    alliance_id: detail.victim.alliance_id,
                    faction_id: detail.victim.faction_id,
                    ship_type_id: detail.victim.ship_type_id,
                    damage_taken: detail.victim.damage_taken,
                    position_x: detail.victim.position?.x,
                    position_y: detail.victim.position?.y,
                    position_z: detail.victim.position?.z,
                },
            });

            // 3. Create attacker records
            if (detail.attackers.length > 0) {
                await tx.attacker.createMany({
                    data: detail.attackers.map(attacker => ({
                        killmail_id: KILLMAIL_ID,
                        character_id: attacker.character_id,
                        corporation_id: attacker.corporation_id,
                        alliance_id: attacker.alliance_id,
                        faction_id: attacker.faction_id,
                        ship_type_id: attacker.ship_type_id,
                        weapon_type_id: attacker.weapon_type_id,
                        damage_done: attacker.damage_done,
                        final_blow: attacker.final_blow,
                        security_status: attacker.security_status,
                    })),
                });
            }

            // 4. Create item records
            if (detail.victim.items && detail.victim.items.length > 0) {
                await tx.killmailItem.createMany({
                    data: detail.victim.items.map(item => ({
                        killmail_id: KILLMAIL_ID,
                        item_type_id: item.item_type_id,
                        flag: item.flag,
                        quantity_dropped: item.quantity_dropped,
                        quantity_destroyed: item.quantity_destroyed,
                        singleton: item.singleton,
                    })),
                });
            }
        });

        console.log(`✅ Killmail ${KILLMAIL_ID} saved successfully!\n`);
        console.log(`🔍 Now run enrichment:`);
        console.log(`   npx tsx test-specific-enrichment.ts ${KILLMAIL_ID}`);

    } catch (error: any) {
        if (error.code === 'P2002') {
            console.log(`ℹ️  Killmail ${KILLMAIL_ID} already exists in database`);
            console.log(`🔍 Run enrichment directly:`);
            console.log(`   npx tsx test-specific-enrichment.ts ${KILLMAIL_ID}`);
        } else {
            console.error('💥 Error:', error);
        }
    } finally {
        await prisma.$disconnect();
    }
}

fetchAndSaveKillmail();
