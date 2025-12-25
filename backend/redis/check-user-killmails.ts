import '../src/config';
import prisma from '../src/services/prisma';

async function checkKillmails() {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            character_id: true,
            character_name: true,
        }
    });

    console.log('═══════════════════════════════════════════════════════');
    console.log('Users in database:');
    console.log('═══════════════════════════════════════════════════════\n');

    for (const user of users) {
        // Count killmails where this character is victim or attacker
        const victimCount = await prisma.killmail.count({
            where: {
                victim: {
                    character_id: user.character_id
                }
            }
        });

        const attackerCount = await prisma.killmail.count({
            where: {
                attackers: {
                    some: {
                        character_id: user.character_id
                    }
                }
            }
        });

        console.log(`👤 ${user.character_name} (ID: ${user.character_id})`);
        console.log(`   Victim in: ${victimCount} killmails`);
        console.log(`   Attacker in: ${attackerCount} killmails`);
        console.log(`   Total: ${victimCount + attackerCount} killmails\n`);
    }

    await prisma.$disconnect();
}

checkKillmails().catch(console.error);
