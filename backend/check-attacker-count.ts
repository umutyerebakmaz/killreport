/**
 * Check attacker_count values in database
 */
import prisma from './src/services/prisma';

async function checkAttackerCounts() {
    console.log('🔍 Checking attacker_count values in database...\n');

    // Check total killmails
    const totalKillmails = await prisma.killmail.count();
    console.log(`Total killmails: ${totalKillmails}`);

    // Check how many have null attacker_count
    const nullCount = await prisma.killmail.count({
        where: { attacker_count: null }
    });
    console.log(`Killmails with NULL attacker_count: ${nullCount}`);

    // Check how many have zero attacker_count
    const zeroCount = await prisma.killmail.count({
        where: { attacker_count: 0 }
    });
    console.log(`Killmails with ZERO attacker_count: ${zeroCount}`);

    // Check how many have non-null attacker_count
    const nonNullCount = await prisma.killmail.count({
        where: { attacker_count: { not: null } }
    });
    console.log(`Killmails with NON-NULL attacker_count: ${nonNullCount}`);

    // Sample some killmails with data
    console.log('\n📊 Sample killmails:');
    const samples = await prisma.killmail.findMany({
        take: 5,
        orderBy: { killmail_time: 'desc' },
        select: {
            killmail_id: true,
            attacker_count: true,
            killmail_time: true,
        }
    });

    samples.forEach(km => {
        console.log(`  Killmail ${km.killmail_id}: attacker_count = ${km.attacker_count}, time = ${km.killmail_time.toISOString()}`);
    });

    // Check actual attacker counts vs cached
    console.log('\n🔬 Verifying cached counts (checking 5 random killmails):');
    const randomSamples = await prisma.killmail.findMany({
        take: 5,
        orderBy: { killmail_time: 'desc' },
        include: {
            _count: {
                select: { attackers: true }
            }
        }
    });

    for (const km of randomSamples) {
        const actualCount = km._count.attackers;
        const cachedCount = km.attacker_count;
        const match = actualCount === cachedCount ? '✅' : '❌';
        console.log(`  ${match} Killmail ${km.killmail_id}: cached=${cachedCount}, actual=${actualCount}`);
    }
}

checkAttackerCounts()
    .catch((error) => {
        console.error('❌ Error:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
