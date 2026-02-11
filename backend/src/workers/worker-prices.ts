/**
 * Jita Price Worker
 * Fetches market prices from ESI and saves to database
 * Processes type_ids from esi_type_price_queue
 *
 * Usage: yarn worker:prices
 */

import logger from '@services/logger';
import { MarketService } from '@services/market/market.service';
import prismaWorker from '@services/prisma-worker';
import { getRabbitMQChannel } from '@services/rabbitmq';

const QUEUE_NAME = 'esi_type_price_queue';
const PREFETCH_COUNT = 10; // Process 10 types concurrently

interface EntityQueueMessage {
  entityId: number;
  queuedAt: string;
  source: string;
}

async function priceWorker() {
  logger.info('🏪 Jita Price Worker Started');
  logger.info(`📦 Queue: ${QUEUE_NAME}`);
  logger.info(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent\n`);

  try {
    const channel = await getRabbitMQChannel();

    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: { 'x-max-priority': 10 },
    });

    channel.prefetch(PREFETCH_COUNT);

    logger.info('✅ Connected to RabbitMQ');
    logger.info('⏳ Waiting for type IDs...\n');

    let totalProcessed = 0;
    let totalSaved = 0;
    let totalErrors = 0;
    let lastMessageTime = Date.now();

    // Check if queue is empty every 5 seconds
    const emptyCheckInterval = setInterval(async () => {
      const timeSinceLastMessage = Date.now() - lastMessageTime;
      if (timeSinceLastMessage > 5000 && totalProcessed > 0) {
        logger.info('\n' + '━'.repeat(60));
        logger.info('✅ Queue completed!');
        logger.info(
          `📊 Final: ${totalProcessed} processed (${totalSaved} saved, ${totalErrors} errors)`
        );
        logger.info('━'.repeat(60) + '\n');
        logger.info('⏳ Waiting for new messages...\n');
      }
    }, 5000);

    channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (msg) lastMessageTime = Date.now();
        if (!msg) return;

        const message: EntityQueueMessage = JSON.parse(msg.content.toString());
        const typeId = message.entityId;

        try {
          // Check if already exists
          const existing = await prismaWorker.marketPrice.findUnique({
            where: { type_id: typeId },
          });

          // Fetch from ESI (always get latest price)
          const price = await MarketService.getJitaPrice(typeId);

          if (price) {
            // Save to database (upsert to prevent race condition)
            await MarketService.savePrice(price);

            if (existing) {
              logger.info(`  ✅ [${totalProcessed + 1}] [${typeId}] Buy=${price.buy.toFixed(2)} Sell=${price.sell.toFixed(2)} (updated)`);
            } else {
              logger.info(`  ✅ [${totalProcessed + 1}] [${typeId}] Buy=${price.buy.toFixed(2)} Sell=${price.sell.toFixed(2)} (created)`);
            }
            totalSaved++;
          } else {
            logger.info(`  - [${totalProcessed + 1}] [${typeId}] (no market orders)`);
          }

          channel.ack(msg);
          totalProcessed++;
        } catch (error) {
          totalErrors++;
          totalProcessed++;
          logger.error(`  ❌ [${totalProcessed}] Type ${typeId} failed:`, error);
          channel.ack(msg); // Ack anyway to avoid reprocessing
        }
      },
      { noAck: false }
    );

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      clearInterval(emptyCheckInterval);
      logger.info('\n👋 Price worker shutting down gracefully...');
      channel.close();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      clearInterval(emptyCheckInterval);
      logger.info('\n👋 Price worker shutting down gracefully...');
      channel.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error('💥 Price worker crashed:', error);
    process.exit(1);
  }
}

priceWorker();
