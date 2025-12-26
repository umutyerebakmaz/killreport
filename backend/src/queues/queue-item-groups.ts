import { ItemGroupService } from '../services/item-group';
import logger from '../services/logger';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_item_group_info_queue';
const BATCH_SIZE = 100;

/**
 * Fetches all item group IDs from ESI and adds them to RabbitMQ queue
 * These will be processed by worker:info:item-groups
 */
async function queueItemGroups() {
    logger.info('Fetching all item group IDs from ESI...');

    try {
        // Get all item group IDs from ESI
        const itemGroupIds = await ItemGroupService.getItemGroupIds();

        logger.info(`Found ${itemGroupIds.length} item groups`);
        logger.info(`Adding to queue: ${QUEUE_NAME}`);

        const channel = await getRabbitMQChannel();

        // Ensure queue exists
        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
            arguments: { 'x-max-priority': 10 },
        });

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
                `Queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(itemGroupIds.length / BATCH_SIZE)}`
            );
        }

        logger.info(`All ${itemGroupIds.length} item groups queued successfully!`);
        logger.info('Run worker with: yarn worker:info:item-groups');

        await channel.close();
        process.exit(0);
    } catch (error) {
        logger.error('Error queueing item groups', { error });
        process.exit(1);
    }
}

queueItemGroups();
