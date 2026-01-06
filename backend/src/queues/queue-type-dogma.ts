import logger from '../services/logger';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_type_dogma_queue';
const BATCH_SIZE = 100;

/**
 * Fetches all type IDs from database and adds them to RabbitMQ queue
 * for dogma attribute/effect synchronization
 * These will be processed by worker:type-dogma
 */
async function queueTypeDogma() {
    logger.info('Fetching all type IDs from database...');

    try {
        // Get all type IDs from our database
        const types = await prisma.type.findMany({
            select: { id: true },
            orderBy: { id: 'asc' },
        });

        const typeIds = types.map((t) => t.id);

        logger.info(`Found ${typeIds.length} types in database`);
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
                    source: 'queue-type-dogma',
                };

                channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
                    persistent: true,
                });
            }

            logger.debug(
                `Queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(typeIds.length / BATCH_SIZE)}`
            );
        }

        logger.info(`All ${typeIds.length} types queued successfully for dogma sync!`);
        logger.info('Run worker with: yarn worker:type-dogma');

        await channel.close();
        process.exit(0);
    } catch (error) {
        logger.error('Error queueing type dogma', { error });
        process.exit(1);
    }
}

queueTypeDogma();
