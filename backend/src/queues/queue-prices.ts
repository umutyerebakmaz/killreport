import '@config';
import logger from '@services/logger';
import prisma from '@services/prisma';
import { getRabbitMQChannel } from '@services/rabbitmq';
import { guardCronJob } from '../utils/cron-guard';

const QUEUE_NAME = 'esi_type_price_queue';
const BATCH_SIZE = 100;

/**
 * Fetches all unique item type IDs from killmail_items and adds them to RabbitMQ queue
 * These will be processed by worker:prices
 *
 * Scheduled: Daily at 06:00 UTC (cron: '0 6 * * *')
 * Usage: yarn queue:prices
 */
async function queuePrices() {
    // Prevent running on PM2 restart - only run daily at 06:00 UTC
    guardCronJob('queue-prices', { hour: 6, minute: 0 });

    logger.info('Fetching unique item type IDs from killmail_items...');

    try {
        // Get all unique item_type_id from killmail_items table
        const items = await prisma.killmailItem.findMany({
            select: { item_type_id: true },
            distinct: ['item_type_id'],
        });

        const typeIds = items.map((i) => i.item_type_id).sort((a, b) => a - b);

        logger.info(`Found ${typeIds.length} unique item types`);
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
                    source: 'queue-prices',
                };

                channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
                    persistent: true,
                });
            }

            logger.debug(
                `Queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
                    typeIds.length / BATCH_SIZE
                )} (${batch.length} types)`
            );
        }

        logger.info(`All ${typeIds.length} item types queued successfully!`);
        logger.info('Now run the worker: yarn worker:prices');

        await channel.close();
        process.exit(0);
    } catch (error) {
        logger.error('Failed to queue prices', { error });
        process.exit(1);
    }
}

queuePrices();
