/**
 * Topology Doctor
 *
 * Reports the integrity gaps the schema deliberately does not enforce.
 *
 * Foreign keys are only created between tables the same pipeline fills. type_id,
 * owner_corporation_id and race_id point at tables the type, corporation and race
 * pipelines own; a foreign key there would lock two ingests together and
 * reintroduce exactly the coupling this design removed. They are reported
 * instead.
 *
 * Read-only. It never writes and never queues anything.
 *
 * Usage: yarn doctor:topology
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getQueueStats } from '@services/rabbitmq';
import { TOPOLOGY_QUEUES } from '../queues/topology-messages';

interface CheckRow {
  check: string;
  count: bigint;
}

async function doctorTopology() {
  logger.info('🩺 Topology doctor\n');

  // Orphaned cross-pipeline references. ::BIGINT comes back as a JavaScript
  // BigInt, so it is converted with Number() before being printed.
  //
  // Two details verified against the schema: types, corporations and races do
  // NOT map their primary key, so the column really is `id` (unlike the celestial
  // tables, where it is planet_id, moon_id and so on); and moons and
  // asteroid_belts carry no type_id column at all, so only four of the six
  // tables are checked for it.
  const orphans = await prismaWorker.$queryRaw<CheckRow[]>`
    SELECT 'planets.type_id'              AS check, COUNT(*)::BIGINT AS count
      FROM planets p LEFT JOIN types t ON t.id = p.type_id
     WHERE p.type_id IS NOT NULL AND t.id IS NULL
    UNION ALL
    SELECT 'stars.type_id', COUNT(*)::BIGINT FROM stars s
      LEFT JOIN types t ON t.id = s.type_id
     WHERE s.type_id IS NOT NULL AND t.id IS NULL
    UNION ALL
    SELECT 'stargates.type_id', COUNT(*)::BIGINT FROM stargates g
      LEFT JOIN types t ON t.id = g.type_id
     WHERE g.type_id IS NOT NULL AND t.id IS NULL
    UNION ALL
    SELECT 'stations.type_id', COUNT(*)::BIGINT FROM stations st
      LEFT JOIN types t ON t.id = st.type_id
     WHERE st.type_id IS NOT NULL AND t.id IS NULL
    UNION ALL
    SELECT 'stations.owner_corporation_id', COUNT(*)::BIGINT FROM stations st
      LEFT JOIN corporations c ON c.id = st.owner_corporation_id
     WHERE st.owner_corporation_id IS NOT NULL AND c.id IS NULL
    UNION ALL
    SELECT 'stations.race_id', COUNT(*)::BIGINT FROM stations st
      LEFT JOIN races r ON r.id = st.race_id
     WHERE st.race_id IS NOT NULL AND r.id IS NULL
    UNION ALL
    SELECT 'stargates.unresolved_destination', COUNT(*)::BIGINT FROM stargates g
     WHERE g.destination_system_id IS NULL
  `;

  logger.info('Cross-pipeline references:');
  for (const row of orphans) {
    const n = Number(row.count);
    logger.info(`  ${n === 0 ? '✅' : '⚠️ '} ${row.check}: ${n}`);
  }

  // Rows the chain created but ESI enrichment never named. Each maps to a repair
  // script: yarn queue:<domain>.
  const [stars, planets, moons, belts, stargates, stations] = await Promise.all(
    [
      prismaWorker.star.count({ where: { name: null } }),
      prismaWorker.planet.count({ where: { name: null } }),
      prismaWorker.moon.count({ where: { name: null } }),
      prismaWorker.asteroidBelt.count({ where: { name: null } }),
      prismaWorker.stargate.count({ where: { name: null } }),
      prismaWorker.station.count({ where: { name: null } }),
    ],
  );

  logger.info('\nRows with no name (run yarn queue:<domain> to repair):');
  logger.info(`  stars: ${stars}           -> yarn queue:stars`);
  logger.info(`  planets: ${planets}         -> yarn queue:planets`);
  logger.info(`  moons: ${moons}           -> yarn queue:moons`);
  logger.info(`  asteroid_belts: ${belts}  -> yarn queue:asteroid-belts`);
  logger.info(`  stargates: ${stargates}       -> yarn queue:stargates`);
  logger.info(`  stations: ${stations}        -> yarn queue:stations`);

  // A DLQ nobody looks at is silent data loss, which is why it is in this report.
  const dlq = await getQueueStats(TOPOLOGY_QUEUES.dlq);
  logger.info(
    `\nDead letter queue (${TOPOLOGY_QUEUES.dlq}): ` +
      `${dlq.exists ? `${dlq.messageCount} messages` : 'not declared yet'}`,
  );
  if (dlq.messageCount > 0) {
    logger.warn(
      '⚠️  Messages gave up after 5 attempts. Inspect them before re-running the scan.',
    );
  }

  await prismaWorker.$disconnect();
  process.exit(0);
}

doctorTopology().catch(async (error) => {
  logger.error('Topology doctor failed', { error });
  await prismaWorker.$disconnect();
  process.exit(1);
});
