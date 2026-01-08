import '../config';
import logger from '../services/logger';
import { getRabbitMQChannel } from '../services/rabbitmq';
import { SolarSystemService } from '../services/solar-system/solar-system.service';

const QUEUE_NAME = 'esi_solar_systems_queue';
const BATCH_SIZE = 100;

/**
 * Fetches all solar system IDs from ESI and adds them to RabbitMQ queue
 */
async function queueSolarSystems() {
  logger.info('Fetching all solar system IDs from ESI...');

  try {
    // Get all solar system IDs from ESI
    const solarSystemIds = await SolarSystemService.getAllSystemIds();

    logger.info(`Found ${solarSystemIds.length} solar systems`);
    logger.info('Adding to queue...');

    const channel = await getRabbitMQChannel();

    // Ensure queue exists
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
    });

    // Add to queue in batches
    for (let i = 0; i < solarSystemIds.length; i += BATCH_SIZE) {
      const batch = solarSystemIds.slice(i, i + BATCH_SIZE);

      for (const id of batch) {
        channel.sendToQueue(QUEUE_NAME, Buffer.from(id.toString()), {
          persistent: true,
        });
      }

      logger.debug(
        `Queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
          solarSystemIds.length / BATCH_SIZE
        )} (${batch.length} solar systems)`
      );
    }

    logger.info(`All ${solarSystemIds.length} solar systems queued successfully!`);
    logger.info('Now run the worker to process them: yarn worker:solar-systems');

    await channel.close();
    process.exit(0);
  } catch (error) {
    logger.error('Failed to queue solar systems', { error });
    process.exit(1);
  }
}

queueSolarSystems();
