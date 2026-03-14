import prisma from './src/services/prisma';

async function checkSystemKills() {
  try {
    // Check if system_kills table has data
    const count = await prisma.systemKills.count();
    console.log('Total system_kills records:', count);

    // Check latest records
    const latest = await prisma.systemKills.findMany({
      take: 5,
      orderBy: { timestamp: 'desc' }
    });
    console.log('\nLatest 5 records:');
    console.log(JSON.stringify(latest, null, 2));

    // Test the raw query used in the resolver
    const testQuery = `
            WITH latest_kills AS (
                SELECT DISTINCT ON (system_id)
                    system_id,
                    ship_kills,
                    pod_kills,
                    npc_kills,
                    timestamp
                FROM system_kills
                ORDER BY system_id, timestamp DESC
            )
            SELECT ss.system_id, ss.name, lk.ship_kills, lk.pod_kills, lk.npc_kills, lk.timestamp
            FROM solar_systems ss
            LEFT JOIN latest_kills lk ON ss.system_id = lk.system_id
            ORDER BY lk.ship_kills DESC NULLS LAST, ss.name ASC
            LIMIT 10
        `;

    const systems: any = await prisma.$queryRawUnsafe(testQuery);
    console.log('\nTop 10 systems by ship_kills:');
    console.log(JSON.stringify(systems, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSystemKills();
