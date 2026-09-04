/**
 * Queue Planets Script
 *
 * Repair tool, not part of the normal flow. The chain creates planet rows:
 * worker-solar-systems publishes them and worker-planets writes them. A planet
 * row with no name means its ESI enrichment failed at some point.
 *
 * The planet message has to carry moonIds and asteroidBeltIds, and both come out
 * of the database rather than ESI: moons.planet_id and asteroid_belts.planet_id
 * were recorded when the chain first ran, so there is no need to go back to
 * /universe/systems/{id}/ for the nesting.
 *
 * Usage: yarn queue:planets
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getRabbitMQChannel } from '@services/rabbitmq';
import {
  TOPOLOGY_QUEUES,
  assertTopologyQueue,
  envelope,
  publishTopology,
} from './topology-messages';

const QUEUE_NAME = TOPOLOGY_QUEUES.planets;
const SOURCE = 'queue-planets';

async function queuePlanets() {
  logger.info('Planet repair queue script started');

  try {
    // The IDs come from the database with WHERE name IS NULL, so a re-run queues
    // only what is still missing. None of the six celestial types has a list
    // endpoint, so the database is the only possible source; POST
    // /universe/names cannot resolve them either.
    const rows = await prismaWorker.planet.findMany({
      where: { name: null },
      select: { id: true, solar_system_id: true, orbit_index: true },
      orderBy: { id: 'asc' },
    });

    if (rows.length === 0) {
      logger.info('Nothing to do: every planet row already has a name.');
      await prismaWorker.$disconnect();
      process.exit(0);
    }

    logger.info(`Found ${rows.length} planet rows with no name`);

    const planetIds = rows.map((r) => r.id);

    // Batch + Map instead of a query per planet.
    const moons = await prismaWorker.moon.findMany({
      where: { planet_id: { in: planetIds } },
      select: { id: true, planet_id: true },
      orderBy: [{ orbit_index: 'asc' }, { id: 'asc' }],
    });
    const belts = await prismaWorker.asteroidBelt.findMany({
      where: { planet_id: { in: planetIds } },
      select: { id: true, planet_id: true },
      orderBy: [{ orbit_index: 'asc' }, { id: 'asc' }],
    });

    const moonsByPlanet = new Map<number, number[]>();
    for (const m of moons) {
      const list = moonsByPlanet.get(m.planet_id) ?? [];
      list.push(m.id);
      moonsByPlanet.set(m.planet_id, list);
    }

    const beltsByPlanet = new Map<number, number[]>();
    for (const b of belts) {
      const list = beltsByPlanet.get(b.planet_id) ?? [];
      list.push(b.id);
      beltsByPlanet.set(b.planet_id, list);
    }

    const channel = await getRabbitMQChannel();
    await assertTopologyQueue(channel, QUEUE_NAME);

    for (const row of rows) {
      publishTopology(channel, QUEUE_NAME, {
        ...envelope(SOURCE),
        planetId: row.id,
        solarSystemId: row.solar_system_id,
        // orbit_index is nullable in the schema but always written by the chain;
        // 0 marks a row that predates it and is worth spotting in the logs.
        orbitIndex: row.orbit_index ?? 0,
        moonIds: moonsByPlanet.get(row.id) ?? [],
        asteroidBeltIds: beltsByPlanet.get(row.id) ?? [],
      });
    }

    logger.info(`Queued ${rows.length} messages to ${QUEUE_NAME}`);
    logger.info('Now run the worker to process them: yarn worker:planets');

    await channel.close();
    await prismaWorker.$disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Failed to queue planets', { error });
    process.exit(1);
  }
}

queuePlanets();
