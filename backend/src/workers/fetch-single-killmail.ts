/**
 * Single Killmail Fetcher
 * ESI'den belirli bir killmail ID'sini çeker ve database'e kaydeder
 *
 * Usage: ts-node src/workers/fetch-single-killmail.ts <killmail_id> <killmail_hash>
 * Example: ts-node src/workers/fetch-single-killmail.ts 131757087 abc123...
 */

import '../config';
import { calculateKillmailValues } from '../helpers/calculate-killmail-values';
import { KillmailService } from '../services/killmail';
import prismaWorker from '../services/prisma-worker';

async function fetchSingleKillmail(killmailId: number, killmailHash: string) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 Fetching Killmail: ${killmailId}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
        // 1. Check if already exists
        const existing = await prismaWorker.killmail.findUnique({
            where: { killmail_id: killmailId },
        });

        if (existing) {
            console.log(`⚠️  Killmail ${killmailId} already exists in database`);
            console.log(`   Created at: ${existing.created_at}`);
            return;
        }

        // 2. Fetch from ESI
        console.log(`📡 Fetching from ESI...`);
        const detail = await KillmailService.getKillmailDetail(killmailId, killmailHash);

        console.log(`✅ Received killmail data`);
        console.log(`   Time: ${detail.killmail_time}`);
        console.log(`   System: ${detail.solar_system_id}`);
        console.log(`   Victim: ${detail.victim.character_id || 'NPC'}`);
        console.log(`   Attackers: ${detail.attackers.length}`);
        console.log(`   Items: ${detail.victim.items?.length || 0}`);

        // 3. Save to database
        console.log(`\n💾 Saving to database...`);

        // ⚡ Calculate value fields before saving
        const values = await calculateKillmailValues({
            victim: { ship_type_id: detail.victim.ship_type_id },
            items: detail.victim.items?.map(item => ({
                item_type_id: item.item_type_id,
                quantity_destroyed: item.quantity_destroyed,
                quantity_dropped: item.quantity_dropped,
            })) || []
        });

        await prismaWorker.$transaction(async (tx) => {
            // Create main killmail record with cached values
            await tx.killmail.create({
                data: {
                    killmail_id: killmailId,
                    killmail_hash: killmailHash,
                    killmail_time: new Date(detail.killmail_time),
                    solar_system_id: detail.solar_system_id,
                    total_value: values.totalValue,
                    destroyed_value: values.destroyedValue,
                    dropped_value: values.droppedValue,
                },
            });

            // Create victim record
            await tx.victim.create({
                data: {
                    killmail_id: killmailId,
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

            // Create attacker records
            if (detail.attackers.length > 0) {
                await tx.attacker.createMany({
                    data: detail.attackers.map(attacker => ({
                        killmail_id: killmailId,
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

            // Create item records
            if (detail.victim.items && detail.victim.items.length > 0) {
                await tx.killmailItem.createMany({
                    data: detail.victim.items.map(item => ({
                        killmail_id: killmailId,
                        item_type_id: item.item_type_id,
                        flag: item.flag,
                        quantity_dropped: item.quantity_dropped,
                        quantity_destroyed: item.quantity_destroyed,
                        singleton: item.singleton,
                    })),
                });
            }
        });

        console.log(`✅ Successfully saved killmail ${killmailId}`);
        console.log(`\n${'='.repeat(60)}`);
        console.log(`✨ Done!`);
        console.log(`${'='.repeat(60)}\n`);

        // Enrichment bilgisi
        console.log(`💡 Tip: Run enrichment to fetch missing character/corp/type data:`);
        console.log(`   yarn scan:entities`);
        console.log(`   yarn worker:info:characters`);
        console.log(`   yarn worker:info:corporations`);
        console.log(`   yarn worker:info:types\n`);

    } catch (error: any) {
        if (error.code === 'P2002') {
            console.log(`⚠️  Killmail ${killmailId} already exists (duplicate key)`);
        } else if (error.response?.status === 404) {
            console.error(`❌ Killmail ${killmailId} not found on ESI`);
            console.error(`   Make sure the killmail ID and hash are correct`);
        } else if (error.response?.status === 422) {
            console.error(`❌ Invalid killmail hash for ID ${killmailId}`);
            console.error(`   The hash does not match this killmail`);
        } else {
            console.error(`❌ Error fetching killmail:`, error);
        }
        process.exit(1);
    }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
    console.error(`\n❌ Usage: ts-node fetch-single-killmail.ts <killmail_id> <killmail_hash>`);
    console.error(`   Example: ts-node fetch-single-killmail.ts 131757087 abc123def456...\n`);
    console.error(`💡 You can get killmail hash from:`);
    console.error(`   - zKillboard: https://zkillboard.com/kill/131757087/`);
    console.error(`   - ESI: Check the killmail detail endpoint\n`);
    process.exit(1);
}

const killmailId = parseInt(args[0], 10);
const killmailHash = args[1];

if (isNaN(killmailId) || killmailId <= 0) {
    console.error(`\n❌ Invalid killmail ID: ${args[0]}`);
    console.error(`   Killmail ID must be a positive number\n`);
    process.exit(1);
}

if (!killmailHash || killmailHash.length < 10) {
    console.error(`\n❌ Invalid killmail hash: ${killmailHash}`);
    console.error(`   Hash should be a 40-character hexadecimal string\n`);
    process.exit(1);
}

// Run the fetcher
fetchSingleKillmail(killmailId, killmailHash)
    .then(() => {
        prismaWorker.$disconnect();
        process.exit(0);
    })
    .catch((error) => {
        console.error(`\n💥 Fatal error:`, error);
        prismaWorker.$disconnect();
        process.exit(1);
    });
