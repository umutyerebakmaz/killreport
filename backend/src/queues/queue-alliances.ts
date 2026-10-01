import { AllianceService } from '@services/alliance';
import logger from '@services/logger';
import { ensureAllQueuesExist, getRabbitMQChannel } from '@services/rabbitmq';
import '@config/config';

const QUEUE_NAME = 'esi_alliance_info_queue';
const BATCH_SIZE = 100;

/**
 * Fetches all alliance IDs from ESI and adds them to RabbitMQ queue
 * These will be processed by worker:info:alliances
 */
async function queueAlliances() {
  logger.info('fetching all alliance IDs from ESI...');

  try {
    // Get all alliance IDs from ESI
    const allianceIds = await AllianceService.getAllAllianceIds();

    logger.info(`found ${allianceIds.length} alliances`);
    logger.info(`adding to queue: ${QUEUE_NAME}`);

    await ensureAllQueuesExist();
    const channel = await getRabbitMQChannel();

    // Add to queue in batches with proper message format
    for (let i = 0; i < allianceIds.length; i += BATCH_SIZE) {
      const batch = allianceIds.slice(i, i + BATCH_SIZE);

      for (const id of batch) {
        const message = {
          entityId: id,
          queuedAt: new Date().toISOString(),
          source: 'queue-alliances',
        };
        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
          persistent: true,
        });
      }

      logger.debug(
        `queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
          allianceIds.length / BATCH_SIZE,
        )} (${batch.length} alliances)`,
      );
    }

    logger.info(`all ${allianceIds.length} alliances queued successfully!`);
    logger.info('now run the worker: yarn worker:info:alliances');

    await channel.close();
    process.exit(0);
  } catch (error) {
    logger.error('failed to queue alliances', { error });
    process.exit(1);
  }
}

queueAlliances();
