import { DogmaEffectService } from '../services/dogma';
import logger from '../services/logger';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_dogma_effect_info_queue';
const BATCH_SIZE = 100;

/**
 * Fetches all dogma effect IDs from ESI and adds them to RabbitMQ queue
 * These will be processed by worker:info:dogma-effects
 */
async function queueDogmaEffects() {
    logger.info('Fetching all dogma effect IDs from ESI...');

    try {
        // Get all dogma effect IDs from ESI
        const effectIds = await DogmaEffectService.getAllEffectIds();

        logger.info(`Found ${effectIds.length} dogma effects`);
        logger.info(`Adding to queue: ${QUEUE_NAME}`);

        const channel = await getRabbitMQChannel();

        // Ensure queue exists
        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
            arguments: { 'x-max-priority': 10 },
        });

        // Add to queue in batches with proper message format
        for (let i = 0; i < effectIds.length; i += BATCH_SIZE) {
            const batch = effectIds.slice(i, i + BATCH_SIZE);

            for (const id of batch) {
                const message = {
                    entityId: id,
                    queuedAt: new Date().toISOString(),
                    source: 'queue-dogma-effects',
                };

                channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
                    persistent: true,
                });
            }

            logger.debug(
                `Queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(effectIds.length / BATCH_SIZE)}`
            );
        }

        logger.info(`All ${effectIds.length} dogma effects queued successfully!`);
        logger.info('Run worker with: yarn worker:info:dogma-effects');

        await channel.close();
        process.exit(0);
    } catch (error) {
        logger.error('Error queueing dogma effects', { error });
        process.exit(1);
    }
}

queueDogmaEffects();
