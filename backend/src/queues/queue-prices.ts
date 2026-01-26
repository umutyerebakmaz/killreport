import '@config';
import logger from '@services/logger';
import prisma from '@services/prisma';
import { getRabbitMQChannel } from '@services/rabbitmq';

const QUEUE_NAME = 'esi_type_price_queue';
const BATCH_SIZE = 100;

/**
 * Fetches all unique item type IDs from killmail_items and ship type IDs from victims
 * Adds them to RabbitMQ queue to be processed by worker:prices
 *
 * Usage: yarn queue:prices
 */
async function queuePrices() {
  logger.info('Fetching unique type IDs from killmail_items and victims...');

  try {
    // Get all unique item_type_id from killmail_items table
    const items = await prisma.killmailItem.findMany({
      select: { item_type_id: true },
      distinct: ['item_type_id'],
    });

    // Get all unique ship_type_id from victims table
    const victims = await prisma.victim.findMany({
      select: { ship_type_id: true },
      distinct: ['ship_type_id'],
    });

    // Combine and deduplicate type IDs
    const itemTypeIds = items.map((i) => i.item_type_id);
    const shipTypeIds = victims.map((v) => v.ship_type_id);
    const allTypeIds = [...new Set([...itemTypeIds, ...shipTypeIds])];
    const typeIds = allTypeIds.sort((a, b) => a - b);

    logger.info(`Found ${itemTypeIds.length} unique item types`);
    logger.info(`Found ${shipTypeIds.length} unique ship types`);
    logger.info(`Total unique types: ${typeIds.length}`);
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
