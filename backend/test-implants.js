const prisma = require('./dist/services/prisma').default;

async function checkPodKillmail() {
    // Find a capsule killmail (group_id = 29)
    const podKillmail = await prisma.killmail.findFirst({
        where: {
            victim: {
                ship_type: {
                    group_id: 29
                }
            }
        },
        include: {
            victim: {
                include: {
                    ship_type: true
                }
            }
        }
    });

    if (!podKillmail) {
        console.log('No pod killmail found');
        return;
    }

    console.log('Found pod killmail:', podKillmail.killmail_id);
    console.log('Ship type:', podKillmail.victim.ship_type.name, 'Group ID:', podKillmail.victim.ship_type.group_id);

    // Get items
    const items = await prisma.killmail_item.findMany({
        where: {
            killmail_id: podKillmail.killmail_id
        },
        include: {
            type: {
                include: {
                    group: true
                }
            }
        }
    });

    console.log('\nTotal items:', items.length);
    console.log('\nItem flags and types:');
    items.forEach(item => {
        console.log(`Flag: ${item.flag}, Type: ${item.type.name}, Group: ${item.type.group.name}`);
    });
}

checkPodKillmail().finally(() => prisma.$disconnect());
