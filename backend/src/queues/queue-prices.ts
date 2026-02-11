import logger from '@services/logger';
import prisma from '@services/prisma';
import { getRabbitMQChannel } from '@services/rabbitmq';

const QUEUE_NAME = 'esi_type_price_queue';
const BATCH_SIZE = 100;

/**
 * Fetches unique type IDs from killmail_items and ship_type_ids from victims
 * Only queues types that are actually used in killmails
 * These will be processed by worker:prices
 */
async function queuePrices() {
  logger.info('Fetching unique type IDs from killmail_items and victims...');

  try {
    // Get all unique item_type_id from killmail_items using raw query for better performance
    logger.info('Querying unique item types from killmail_items...');
    const itemTypes = await prisma.$queryRaw<{ item_type_id: number }[]>`
      SELECT DISTINCT item_type_id FROM killmail_items
    `;
    logger.info(`✓ Found ${itemTypes.length} unique item types`);

    // Get all unique ship_type_id from victims using raw query
    logger.info('Querying unique ship types from victims...');
    const shipTypes = await prisma.$queryRaw<{ ship_type_id: number }[]>`
      SELECT DISTINCT ship_type_id FROM victims
    `;
    logger.info(`✓ Found ${shipTypes.length} unique ship types`);

    // Combine and deduplicate
    const itemTypeIds = itemTypes.map((i) => i.item_type_id);
    const shipTypeIds = shipTypes.map((v) => v.ship_type_id);
    const allTypeIds = [...new Set([...itemTypeIds, ...shipTypeIds])];
    const typeIds = allTypeIds.sort((a, b) => a - b);

    logger.info(`Total unique types to queue: ${typeIds.length}`);
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

      logger.info(
        `Queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
          typeIds.length / BATCH_SIZE
        )} (${batch.length} types)`
      );
    }

    logger.info(`All ${typeIds.length} types queued successfully!`);
    logger.info('Now run the worker: yarn worker:prices');

    await channel.close();
    process.exit(0);
  } catch (error) {
    logger.error('Failed to queue prices', { error });
    process.exit(1);
  }
}

queuePrices();
