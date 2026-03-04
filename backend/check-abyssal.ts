import prisma from './src/services/prisma';

async function test() {
  // Check for Abyssal systems (typically system_id >= 31000000 and < 32000000)
  const abyssalSystems = await prisma.solarSystem.findMany({
    where: {
      id: {
        gte: 31000000,
        lt: 32000000
      }
    },
    take: 5,
    select: {
      id: true,
      name: true,
      security_status: true,
      security_class: true,
    }
  });

  console.log('Sample Abyssal systems (31000000-32000000):');
  if (abyssalSystems.length > 0) {
    abyssalSystems.forEach(s => {
      console.log(`  System ${s.id}: ${s.name}, sec=${s.security_status}, class=${s.security_class}`);
    });
  } else {
    console.log('  No systems found in range 31000000-32000000');
  }

  // Check if there are any killmails in this range
  const abyssalKillmails = await prisma.$queryRaw<Array<{count: bigint}>>`
    SELECT COUNT(*) as count FROM killmail_filters WHERE solar_system_id >= 31000000 AND solar_system_id < 32000000
  `;
  console.log('\nAbyssal killmails count:', abyssalKillmails[0].count.toString());

  // Check for systems with specific security_class that might indicate Abyssal
  const securityClasses = await prisma.$queryRaw<Array<{security_class: string | null, count: bigint}>>`
    SELECT security_class, COUNT(*) as count
    FROM solar_systems
    WHERE security_class IS NOT NULL
    GROUP BY security_class
    ORDER BY count DESC
  `;
  
  console.log('\nAll security_class values in database:');
  securityClasses.forEach(sc => {
    console.log(`  security_class='${sc.security_class}': ${sc.count} systems`);
  });

  await prisma.$disconnect();
}

test().catch(console.error);
