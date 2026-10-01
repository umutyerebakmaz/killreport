import { ItemGroupService } from '@services/item-group';
import logger from '@services/logger';
import { ensureAllQueuesExist, getRabbitMQChannel } from '@services/rabbitmq';

const QUEUE_NAME = 'esi_item_group_info_queue';
const BATCH_SIZE = 100;

/**
 * Fetches all item group IDs from ESI and adds them to RabbitMQ queue
 * These will be processed by worker:info:item-groups
 */
async function queueItemGroups() {
  logger.info('fetching all item group IDs from ESI...');

  try {
    // Get all item group IDs from ESI
    const itemGroupIds = await ItemGroupService.getItemGroupIds();

    logger.info(`found ${itemGroupIds.length} item groups`);
    logger.info(`adding to queue: ${QUEUE_NAME}`);

    await ensureAllQueuesExist();
    const channel = await getRabbitMQChannel();

    // Add to queue in batches with proper message format
    for (let i = 0; i < itemGroupIds.length; i += BATCH_SIZE) {
      const batch = itemGroupIds.slice(i, i + BATCH_SIZE);

      for (const id of batch) {
        const message = {
          entityId: id,
          queuedAt: new Date().toISOString(),
          source: 'queue-item-groups',
        };

        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
          persistent: true,
        });
      }

      logger.debug(
        `queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(itemGroupIds.length / BATCH_SIZE)}`,
      );
    }

    logger.info(`all ${itemGroupIds.length} item groups queued successfully!`);
    logger.info('run worker with: yarn worker:info:item-groups');

    await channel.close();
    process.exit(0);
  } catch (error) {
    logger.error('error queueing item groups', { error });
    process.exit(1);
  }
}

queueItemGroups();
