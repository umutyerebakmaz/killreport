import '../config';
import { CategoryService } from '../services/category';
import logger from '../services/logger';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_category_info_queue';
const BATCH_SIZE = 50;

/**
 * Fetches all category IDs from ESI and adds them to RabbitMQ queue
 * These will be processed by worker:info:categories
 */
async function queueCategories() {
    logger.info('Fetching all category IDs from ESI...');

    try {
        // Get all category IDs from ESI
        const categoryIds = await CategoryService.getAllCategoryIds();

        logger.info(`Found ${categoryIds.length} categories`);
        logger.info(`Adding to queue: ${QUEUE_NAME}`);

        const channel = await getRabbitMQChannel();

        // Ensure queue exists
        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
            arguments: { 'x-max-priority': 10 },
        });

        // Add to queue in batches with proper message format
        for (let i = 0; i < categoryIds.length; i += BATCH_SIZE) {
            const batch = categoryIds.slice(i, i + BATCH_SIZE);

            for (const id of batch) {
                const message = {
                    entityId: id,
                    queuedAt: new Date().toISOString(),
                    source: 'queue-categories',
                };
                channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
                    persistent: true,
                });
            }

            logger.debug(
                `Queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
                    categoryIds.length / BATCH_SIZE
                )} (${batch.length} categories)`
            );
        }

        logger.info(`All ${categoryIds.length} categories queued successfully!`);
        logger.info('Now run the worker: yarn worker:info:categories');

        await channel.close();
        process.exit(0);
    } catch (error) {
        logger.error('Failed to queue categories', { error });
        process.exit(1);
    }
}

queueCategories();
