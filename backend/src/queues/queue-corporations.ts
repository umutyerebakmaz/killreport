import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { ensureAllQueuesExist, getRabbitMQChannel } from '@services/rabbitmq';

const QUEUE_NAME = 'esi_corporation_info_queue';
const BATCH_SIZE = 100;

/**
 * Queues corporation IDs to update from ESI
 * Usage:
 *   yarn queue:corporations              # Queue ALL corporations from DB
 *   yarn queue:corporations 123 456 789  # Queue specific corporation IDs
 */
async function queueCorporations() {
  try {
    // Get corporation IDs from command line arguments or database
    const args = process.argv.slice(2);
    let corporationIds: number[] = [];

    if (args.length > 0) {
      // Queue specific corporation IDs from arguments
      corporationIds = args
        .map((arg) => parseInt(arg, 10))
        .filter((id) => !isNaN(id));

      if (corporationIds.length === 0) {
        logger.error('invalid corporation IDs provided');
        process.exit(1);
      }

      logger.info(
        `queueing ${corporationIds.length} specific corporation(s): ${corporationIds.join(', ')}`,
      );
    } else {
      // Queue all corporations from database
      logger.info('fetching all corporation IDs from database...');
      const corporations = await prismaWorker.corporation.findMany({
        select: { id: true },
        orderBy: { id: 'asc' },
      });
      corporationIds = corporations.map((c) => c.id);
      logger.info(`found ${corporationIds.length} corporations in database`);
    }

    logger.info(`adding to queue: ${QUEUE_NAME}`);

    await ensureAllQueuesExist();
    const channel = await getRabbitMQChannel();

    // Add to queue in batches with proper message format
    let queuedCount = 0;
    for (let i = 0; i < corporationIds.length; i += BATCH_SIZE) {
      const batch = corporationIds.slice(i, i + BATCH_SIZE);

      for (const id of batch) {
        const message = {
          entityId: id,
          queuedAt: new Date().toISOString(),
          source: 'queue-corporations',
        };
        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
          persistent: true,
        });
        queuedCount++;
      }

      if (corporationIds.length > 100) {
        logger.debug(
          `queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
            corporationIds.length / BATCH_SIZE,
          )} (${batch.length} corporations)`,
        );
      }
    }

    logger.info(`✅ all ${queuedCount} corporation(s) queued successfully!`);
    logger.info('now run the worker: yarn worker:info:corporations');

    await channel.close();
    process.exit(0);
  } catch (error) {
    logger.error('failed to queue corporations', { error });
    process.exit(1);
  }
}

queueCorporations();
