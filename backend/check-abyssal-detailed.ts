import prisma from './src/services/prisma';

async function test() {
    // Check different ID ranges
    console.log('Checking different system ID ranges...\n');

    // Pochven systems (Triglavian space) - usually 30000000-31000000
    const pochvenSystems = await prisma.solarSystem.findMany({
        where: {
            id: {
                gte: 30000000,
                lt: 31000000
            }
        },
        take: 5,
        select: { id: true, name: true, security_status: true, security_class: true }
    });
    console.log('Sample Pochven/Triglavian systems (30000000-31000000):');
    pochvenSystems.forEach(s => {
        console.log(`  ${s.id}: ${s.name}, sec=${s.security_status}, class=${s.security_class}`);
    });

    // Special systems including Thera (31000000-32000000)
    const specialSystems = await prisma.solarSystem.findMany({
        where: {
            id: {
                gte: 31000000,
                lt: 32000000
            }
        },
        take: 10,
        orderBy: { id: 'asc' },
        select: { id: true, name: true, security_status: true, security_class: true }
    });
    console.log('\nSpecial systems (31000000-32000000):');
    specialSystems.forEach(s => {
        console.log(`  ${s.id}: ${s.name}, sec=${s.security_status}, class=${s.security_class}`);
    });

    // Check for Abyssal in system names
    const abyssalNamedSystems = await prisma.solarSystem.findMany({
        where: {
            name: {
                contains: 'Abyss',
                mode: 'insensitive'
            }
        },
        take: 10,
        select: { id: true, name: true, security_status: true, security_class: true }
    });
    console.log('\nSystems with "Abyss" in name:');
    if (abyssalNamedSystems.length > 0) {
        abyssalNamedSystems.forEach(s => {
            console.log(`  ${s.id}: ${s.name}, sec=${s.security_status}, class=${s.security_class}`);
        });
    } else {
        console.log('  No systems found');
    }

    // Check killmail system ID distribution for high IDs
    const highIdKillmails = await prisma.$queryRaw<Array<{ solar_system_id: number, count: bigint, name: string }>>`
    SELECT kf.solar_system_id, COUNT(*) as count, ss.name
    FROM killmail_filters kf
    LEFT JOIN solar_systems ss ON kf.solar_system_id = ss.id
    WHERE kf.solar_system_id >= 31000000
    GROUP BY kf.solar_system_id, ss.name
    ORDER BY count DESC
    LIMIT 10
  `;
    console.log('\nTop 10 systems with ID >= 31000000 by killmail count:');
    highIdKillmails.forEach(km => {
        console.log(`  ${km.solar_system_id}: ${km.name} - ${km.count} killmails`);
    });

    // Check if there's a specific security_class for Abyssal
    const securityStatusDistribution = await prisma.$queryRaw<Array<{ security_status: number | null, count: bigint }>>`
    SELECT security_status, COUNT(*) as count
    FROM solar_systems
    WHERE id >= 31000000 AND id < 32000000
    GROUP BY security_status
    ORDER BY count DESC
    LIMIT 10
  `;
    console.log('\nSecurity status distribution for systems 31000000-32000000:');
    securityStatusDistribution.forEach(s => {
        console.log(`  sec=${s.security_status}: ${s.count} systems`);
    });

    await prisma.$disconnect();
}

test().catch(console.error);
