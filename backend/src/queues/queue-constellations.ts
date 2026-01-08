import '../config';
import { ConstellationService } from '../services/constellation';
import logger from '../services/logger';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_constellations_queue';
const BATCH_SIZE = 100;

/**
 * Fetches all constellation IDs from ESI and adds them to RabbitMQ queue
 */
async function queueConstellations() {
    logger.info('Fetching all constellation IDs from ESI...');

    try {
        // Get all constellation IDs from ESI
        const constellationIds = await ConstellationService.getAllConstellationIds();

        logger.info(`Found ${constellationIds.length} constellations`);
        logger.info('Adding to queue...');

        const channel = await getRabbitMQChannel();

        // Ensure queue exists
        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
        });

        // Add to queue in batches
        for (let i = 0; i < constellationIds.length; i += BATCH_SIZE) {
            const batch = constellationIds.slice(i, i + BATCH_SIZE);

            for (const id of batch) {
                channel.sendToQueue(QUEUE_NAME, Buffer.from(id.toString()), {
                    persistent: true,
                });
            }

            logger.debug(
                `Queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
                    constellationIds.length / BATCH_SIZE
                )} (${batch.length} constellations)`
            );
        }

        logger.info(`All ${constellationIds.length} constellations queued successfully!`);
        logger.info('Now run the worker to process them: yarn worker:constellations');

        await channel.close();
        process.exit(0);
    } catch (error) {
        logger.error('Failed to queue constellations', { error });
        process.exit(1);
    }
}

queueConstellations();
