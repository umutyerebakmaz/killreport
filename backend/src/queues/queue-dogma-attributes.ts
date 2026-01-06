import { DogmaAttributeService } from '../services/dogma';
import logger from '../services/logger';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_dogma_attribute_info_queue';
const BATCH_SIZE = 100;

/**
 * Fetches all dogma attribute IDs from ESI and adds them to RabbitMQ queue
 * These will be processed by worker:info:dogma-attributes
 */
async function queueDogmaAttributes() {
    logger.info('Fetching all dogma attribute IDs from ESI...');

    try {
        // Get all dogma attribute IDs from ESI
        const attributeIds = await DogmaAttributeService.getAllAttributeIds();

        logger.info(`Found ${attributeIds.length} dogma attributes`);
        logger.info(`Adding to queue: ${QUEUE_NAME}`);

        const channel = await getRabbitMQChannel();

        // Ensure queue exists
        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
            arguments: { 'x-max-priority': 10 },
        });

        // Add to queue in batches with proper message format
        for (let i = 0; i < attributeIds.length; i += BATCH_SIZE) {
            const batch = attributeIds.slice(i, i + BATCH_SIZE);

            for (const id of batch) {
                const message = {
                    entityId: id,
                    queuedAt: new Date().toISOString(),
                    source: 'queue-dogma-attributes',
                };

                channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
                    persistent: true,
                });
            }

            logger.debug(
                `Queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(attributeIds.length / BATCH_SIZE)}`
            );
        }

        logger.info(`All ${attributeIds.length} dogma attributes queued successfully!`);
        logger.info('Run worker with: yarn worker:info:dogma-attributes');

        await channel.close();
        process.exit(0);
    } catch (error) {
        logger.error('Error queueing dogma attributes', { error });
        process.exit(1);
    }
}

queueDogmaAttributes();
