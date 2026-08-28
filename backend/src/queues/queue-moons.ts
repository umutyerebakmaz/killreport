/**
 * Queue Moons Script
 *
 * Reads moon IDs that still have no name out of the database and queues
 * them for enrichment. The rows themselves are created in step 2 by
 * worker-solar-systems.
 *
 * Usage: yarn queue:moons
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getRabbitMQChannel } from '@services/rabbitmq';

const QUEUE_NAME = 'esi_moons_queue';

async function queueMoons() {
  logger.info('Moon queue script started');

  try {
    // Enrichment queue, not a root scan: the IDs come from the database with
    // WHERE name IS NULL, so a re-run queues only what is still missing. None of
    // the six celestial types has a list endpoint, so the database is the only
    // possible source; POST /universe/names cannot resolve them either.
    const rows = await prismaWorker.moon.findMany({
      where: { name: null },
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    if (rows.length === 0) {
      logger.info('Nothing to do: every moon row already has a name.');
      await prismaWorker.$disconnect();
      process.exit(0);
    }

    logger.info(`Found ${rows.length} moon rows with no name`);

    const channel = await getRabbitMQChannel();
    // x-max-priority is mandatory: server.ts's ensureAllQueuesExist() declares
    // every queue with it, and omitting it fails with 406 PRECONDITION_FAILED.
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: { 'x-max-priority': 10 },
    });

    for (const row of rows) {
      channel.sendToQueue(QUEUE_NAME, Buffer.from(row.id.toString()), {
        persistent: true,
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
