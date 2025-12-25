import '../src/config';
import prisma from '../src/services/prisma';

const CHARACTER_ID = 365974960; // General XAN
const CHARACTER_NAME = 'General XAN';

async function deleteCharacterKillmails() {
    console.log('═══════════════════════════════════════════════════════');
    console.log(`🗑️  Deleting killmails for ${CHARACTER_NAME} (ID: ${CHARACTER_ID})`);
    console.log('═══════════════════════════════════════════════════════\n');

    try {
        // Find killmails where character is victim
        const victimKillmails = await prisma.killmail.findMany({
            where: {
                victim: {
                    character_id: CHARACTER_ID
                }
            },
            select: {
                killmail_id: true
            }
        });

        // Find killmails where character is attacker
        const attackerKillmails = await prisma.killmail.findMany({
            where: {
                attackers: {
                    some: {
                        character_id: CHARACTER_ID
                    }
                }
            },
            select: {
                killmail_id: true
            }
        });

        const victimKillmailIds = victimKillmails.map(km => km.killmail_id);
        const attackerKillmailIds = attackerKillmails.map(km => km.killmail_id);

        // Combine and get unique killmail IDs
        const allKillmailIds = [...new Set([...victimKillmailIds, ...attackerKillmailIds])];

        console.log(`📊 Found killmails:`);
        console.log(`   - Victim in: ${victimKillmailIds.length} killmails`);
        console.log(`   - Attacker in: ${attackerKillmailIds.length} killmails`);
        console.log(`   - Total unique: ${allKillmailIds.length} killmails\n`);

        if (allKillmailIds.length === 0) {
            console.log('⚠️  No killmails found for this character\n');
            await prisma.$disconnect();
            process.exit(0);
        }

        // Delete in correct order (foreign key constraints)
        console.log('🗑️  Deleting records...\n');

        // 1. Delete killmail items
        const deletedItems = await prisma.killmailItem.deleteMany({
            where: {
                killmail_id: {
                    in: allKillmailIds
                }
            }
        });
        console.log(`   ✓ Deleted ${deletedItems.count} killmail items`);

        // 2. Delete attackers
        const deletedAttackers = await prisma.attacker.deleteMany({
            where: {
                killmail_id: {
                    in: allKillmailIds
                }
            }
        });
        console.log(`   ✓ Deleted ${deletedAttackers.count} attackers`);

        // 3. Delete victims
        const deletedVictims = await prisma.victim.deleteMany({
            where: {
                killmail_id: {
                    in: allKillmailIds
                }
            }
        });
        console.log(`   ✓ Deleted ${deletedVictims.count} victims`);

        // 4. Delete killmails
        const deletedKillmails = await prisma.killmail.deleteMany({
            where: {
                killmail_id: {
                    in: allKillmailIds
                }
            }
        });
        console.log(`   ✓ Deleted ${deletedKillmails.count} killmails\n`);

        console.log('═══════════════════════════════════════════════════════');
        console.log(`✅ Successfully deleted all killmails for ${CHARACTER_NAME}`);
        console.log('═══════════════════════════════════════════════════════\n');

        await prisma.$disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to delete killmails:', error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

deleteCharacterKillmails();
