/**
 * Queue Moons Script
 *
 * Repair tool, not part of the normal flow. The chain creates moon rows:
 * worker-planets publishes them and worker-moons writes them. A moon row with no
 * name means its ESI enrichment failed at some point.
 *
 * planet_id and orbit_index come out of the database rather than ESI, because
 * /universe/moons/{id}/ does not return planet_id and the chain already recorded
 * both when the row was created.
 *
 * Usage: yarn queue:moons
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

const QUEUE_NAME = TOPOLOGY_QUEUES.moons;
const SOURCE = 'queue-moons';

async function queueMoons() {
  logger.info('Moon repair queue script started');

  try {
    // The IDs come from the database with WHERE name IS NULL, so a re-run queues
    // only what is still missing. None of the six celestial types has a list
    // endpoint, so the database is the only possible source; POST
    // /universe/names cannot resolve them either.
    const rows = await prismaWorker.moon.findMany({
      where: { name: null },
      select: {
        id: true,
        solar_system_id: true,
        planet_id: true,
        orbit_index: true,
      },
      orderBy: { id: 'asc' },
    });

    if (rows.length === 0) {
      logger.info('Nothing to do: every moon row already has a name.');
      await prismaWorker.$disconnect();
      process.exit(0);
    }

    logger.info(`Found ${rows.length} moon rows with no name`);

    const channel = await getRabbitMQChannel();
    await assertTopologyQueue(channel, QUEUE_NAME);

    for (const row of rows) {
      publishTopology(channel, QUEUE_NAME, {
        ...envelope(SOURCE),
        moonId: row.id,
        solarSystemId: row.solar_system_id,
        planetId: row.planet_id,
        // orbit_index is nullable in the schema but always written by the chain;
        // 0 marks a row that predates it and is worth spotting in the logs.
        orbitIndex: row.orbit_index ?? 0,
      });
    }

    logger.info(`Queued ${rows.length} messages to ${QUEUE_NAME}`);
    logger.info('Now run the worker to process them: yarn worker:moons');

    await channel.close();
    await prismaWorker.$disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Failed to queue moons', { error });
    process.exit(1);
  }
}

queueMoons();
