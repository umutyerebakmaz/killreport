import logger from '@services/logger';
import { getRabbitMQChannel } from '@services/rabbitmq';
import { RegionService } from '@services/region';

const QUEUE_NAME = 'esi_regions_queue';
const BATCH_SIZE = 100;

/**
 * Fetches all region IDs from ESI and adds them to RabbitMQ queue
 */
async function queueRegions() {
  logger.info('Fetching all region IDs from ESI...');

  try {
    // Get all region IDs from ESI
    const regionIds = await RegionService.getAllRegionIds();

    logger.info(`Found ${regionIds.length} regions`);
    logger.info('Adding to queue...');

    const channel = await getRabbitMQChannel();

    // Ensure queue exists
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      // Every other queue in the repo is declared with this, and server.ts's
      // ensureAllQueuesExist() creates them all that way. Omitting it makes
      // assertQueue fail with 406 PRECONDITION_FAILED.
      arguments: { 'x-max-priority': 10 },
    });

    // Add to queue in batches
    for (let i = 0; i < regionIds.length; i += BATCH_SIZE) {
      const batch = regionIds.slice(i, i + BATCH_SIZE);

      for (const id of batch) {
        channel.sendToQueue(QUEUE_NAME, Buffer.from(id.toString()), {
          persistent: true,
        });
      }

      logger.debug(
        `Queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
          regionIds.length / BATCH_SIZE,
        )} (${batch.length} regions)`,
      );
    }

    logger.info(`All ${regionIds.length} regions queued successfully!`);
    logger.info('Now run the worker to process them: yarn worker:regions');

    await channel.close();
    process.exit(0);
  } catch (error) {
    logger.error('Failed to queue regions', { error });
    process.exit(1);
  }
}

queueRegions();
