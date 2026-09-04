/**
 * Queue Stations Script
 *
 * Repair tool, not part of the normal flow. The chain creates station rows:
 * worker-solar-systems publishes the station ID and worker-stations writes the
 * row. A station row with no name means its ESI enrichment failed at some point.
 *
 * Usage: yarn queue:stations
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

const QUEUE_NAME = TOPOLOGY_QUEUES.stations;
const SOURCE = 'queue-stations';

async function queueStations() {
  logger.info('Station repair queue script started');

  try {
    // The IDs come from the database with WHERE name IS NULL, so a re-run queues
    // only what is still missing. None of the six celestial types has a list
    // endpoint, so the database is the only possible source; POST
    // /universe/names cannot resolve them either.
    const rows = await prismaWorker.station.findMany({
      where: { name: null },
      select: { id: true, solar_system_id: true },
      orderBy: { id: 'asc' },
    });

    if (rows.length === 0) {
      logger.info('Nothing to do: every station row already has a name.');
      await prismaWorker.$disconnect();
      process.exit(0);
    }

    logger.info(`Found ${rows.length} station rows with no name`);

    const channel = await getRabbitMQChannel();
    await assertTopologyQueue(channel, QUEUE_NAME);

    for (const row of rows) {
      publishTopology(channel, QUEUE_NAME, {
        ...envelope(SOURCE),
        stationId: row.id,
        solarSystemId: row.solar_system_id,
      });
    }

    logger.info(`Queued ${rows.length} messages to ${QUEUE_NAME}`);
    logger.info('Now run the worker to process them: yarn worker:stations');

    await channel.close();
    await prismaWorker.$disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Failed to queue stations', { error });
    process.exit(1);
  }
}

queueStations();
