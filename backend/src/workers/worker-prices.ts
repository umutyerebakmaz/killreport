/**
 * Jita Price Worker
 * Fetches market prices from ESI and saves to database
 * Processes type_ids from esi_type_price_queue
 *
 * Usage: yarn worker:prices
 */

import { config } from '@config/config';
import logger from '@services/logger';
import { MarketService } from '@services/market/market.service';
import { ensureAllQueuesExist, getRabbitMQChannel } from '@services/rabbitmq';
import { handleWorkerError } from './worker-error';

const QUEUE_NAME = 'esi_type_price_queue';
// Concurrency, not a rate limit - the shared limiter (esiLimiter) owns the dispatch ceiling.
// Its job is to keep that ceiling fed, so it has to be at least a fraction of
// the target rate. Override per run with ESI_PREFETCH.
const PREFETCH_COUNT = Math.max(
  config.esi.prefetch,
  Math.ceil(config.esi.maxRequestsPerSecond / 2),
);

interface EntityQueueMessage {
  entityId: number;
  queuedAt: string;
  source: string;
}

async function priceWorker() {
  logger.info('🏪 Jita price worker started');
  logger.info(`📦 queue: ${QUEUE_NAME}`);
  logger.info(`⚡ prefetch: ${PREFETCH_COUNT} concurrent\n`);

  try {
    await ensureAllQueuesExist();
    const channel = await getRabbitMQChannel();

    channel.prefetch(PREFETCH_COUNT);

    logger.info('✅ connected to RabbitMQ');
    logger.info('⏳ waiting for type IDs...\n');

    let totalProcessed = 0;
    let totalSaved = 0;
    let totalErrors = 0;
    let lastMessageTime = Date.now();

    // Check if queue is empty every 5 seconds
    const emptyCheckInterval = setInterval(async () => {
      const timeSinceLastMessage = Date.now() - lastMessageTime;
      if (timeSinceLastMessage > 5000 && totalProcessed > 0) {
        logger.info('\n' + '━'.repeat(60));
        logger.info('✅ queue completed!');
        logger.info(
          `📊 final: ${totalProcessed} processed (${totalSaved} saved, ${totalErrors} errors)`,
        );
        logger.info('━'.repeat(60) + '\n');
        logger.info('⏳ waiting for new messages...\n');
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
          // Every page, Jita 4-4 only; null when Jita has no orders, and then
          // the stored price is left as it was. ESI and database errors
          // reach handleWorkerError below.
          const price = await MarketService.getJitaPrice(typeId);

          if (price) {
            await MarketService.savePrice(price);
            // Prisma's upsert does not say whether the row was new.
            logger.info(
              `  ✅ [${totalProcessed + 1}] [${typeId}] buy=${price.buy.toFixed(2)} sell=${price.sell.toFixed(2)} (saved)`,
            );
            totalSaved++;
          } else {
            logger.info(
              `  - [${totalProcessed + 1}] [${typeId}] (no Jita orders)`,
            );
          }

          channel.ack(msg);
          totalProcessed++;
        } catch (error) {
          totalErrors++;
          totalProcessed++;
          // 404, the 420 backoff and the attempt count all live in the
          // shared path now; this worker only says which message it was.
          await handleWorkerError(channel, msg, QUEUE_NAME, error, {
            warn: (m) => logger.warn(`  ${m} (type ${typeId})`),
            error: (m, e) => logger.error(`  ${m} (type ${typeId})`, e),
          });
        }
      },
      { noAck: false },
    );

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      clearInterval(emptyCheckInterval);
      logger.info('\n👋 price worker shutting down gracefully...');
      channel.close();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      clearInterval(emptyCheckInterval);
      logger.info('\n👋 price worker shutting down gracefully...');
      channel.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error('💥 price worker crashed:', error);
    process.exit(1);
  }
}

priceWorker();
