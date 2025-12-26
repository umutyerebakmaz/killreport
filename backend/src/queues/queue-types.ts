import logger from '../services/logger';
import { getRabbitMQChannel } from '../services/rabbitmq';
import { TypeService } from '../services/type';

const QUEUE_NAME = 'esi_type_info_queue';
const BATCH_SIZE = 100;

/**
 * Fetches all type IDs from ESI and adds them to RabbitMQ queue
 * These will be processed by worker:info:types
 */
async function queueTypes() {
    logger.info('Fetching all type IDs from ESI...');

    try {
        // Get all type IDs from ESI (fetches from all item groups)
        const typeIds = await TypeService.getTypeIds();

        logger.info(`Found ${typeIds.length} types`);
        logger.info(`Adding to queue: ${QUEUE_NAME}`);

        const channel = await getRabbitMQChannel();

        // Ensure queue exists
        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
            arguments: { 'x-max-priority': 10 },
        });

        // Add to queue in batches with proper message format
        for (let i = 0; i < typeIds.length; i += BATCH_SIZE) {
            const batch = typeIds.slice(i, i + BATCH_SIZE);

            for (const id of batch) {
                const message = {
                    entityId: id,
                    queuedAt: new Date().toISOString(),
                    source: 'queue-types',
                };

                channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
                    persistent: true,
                });
            }

            logger.debug(
                `Queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(typeIds.length / BATCH_SIZE)}`
            );
        }

        logger.info(`All ${typeIds.length} types queued successfully!`);
        logger.info('Run worker with: yarn worker:info:types');

        await channel.close();
        process.exit(0);
    } catch (error) {
        logger.error('Error queueing types', { error });
        process.exit(1);
    }
}

queueTypes();
