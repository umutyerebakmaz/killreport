/**
 * Corporation Info Worker
 * Fetches corporation information from ESI and saves to database
 */

import { CorporationService } from '@services/corporation';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { ensureAllQueuesExist, getRabbitMQChannel } from '@services/rabbitmq';
import { handleWorkerError } from './worker-error';

const QUEUE_NAME = 'esi_corporation_info_queue';
const PREFETCH_COUNT = 25; // Process up to 25 corporations concurrently (ESI throughput is capped at 50/sec by esiRateLimiter)

interface EntityQueueMessage {
  entityId: number;
  queuedAt: string;
  source: string;
}

let isShuttingDown = false;
let emptyCheckInterval: NodeJS.Timeout | null = null;

async function corporationInfoWorker() {
  logger.info('🏢 Corporation Info Worker Started');
  logger.info(`📦 Queue: ${QUEUE_NAME}`);
  logger.info(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent\n`);

  await ensureAllQueuesExist();
  while (!isShuttingDown) {
    try {
      const channel = await getRabbitMQChannel();

      channel.prefetch(PREFETCH_COUNT);

      logger.info('✅ Connected to RabbitMQ');
      logger.info('⏳ Waiting for corporations...\n');

      let totalProcessed = 0;
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalErrors = 0;
      let lastMessageTime = Date.now();

      // Clear any existing interval
      if (emptyCheckInterval) {
        clearInterval(emptyCheckInterval);
      }

      // Check if queue is empty every 5 seconds
      emptyCheckInterval = setInterval(async () => {
        const timeSinceLastMessage = Date.now() - lastMessageTime;
        if (timeSinceLastMessage > 5000 && totalProcessed > 0) {
          logger.info('\n' + '━'.repeat(60));
          logger.info('✅ Queue completed!');
          logger.info(
            `📊 Final: ${totalProcessed} processed (${totalCreated} created, ${totalUpdated} updated, ${totalErrors} errors)`,
          );
          logger.info('━'.repeat(60) + '\n');
          logger.info('⏳ Waiting for new messages...\n');
        }
      }, 5000);

      // Handle channel errors
      channel.on('error', (err) => {
        logger.error('❌ Channel error:', err.message);
        if (emptyCheckInterval) {
          clearInterval(emptyCheckInterval);
          emptyCheckInterval = null;
        }
      });

      channel.on('close', () => {
        logger.warn('⚠️  Channel closed');
        if (emptyCheckInterval) {
          clearInterval(emptyCheckInterval);
          emptyCheckInterval = null;
        }
      });

      await channel.consume(
        QUEUE_NAME,
        async (msg) => {
          if (msg) lastMessageTime = Date.now();
          if (!msg) return;

          const message: EntityQueueMessage = JSON.parse(
            msg.content.toString(),
          );
          const corporationId = message.entityId;

          try {
            // Check if already exists
            const existing = await prismaWorker.corporation.findUnique({
              where: { id: corporationId },
            });

            // Fetch from ESI (her zaman güncel bilgiyi al)
            const corpInfo =
              await CorporationService.getCorporationInfo(corporationId);

            // Save to database (upsert to prevent race condition)
            await prismaWorker.corporation.upsert({
              where: { id: corporationId },
              create: {
                id: corporationId,
                name: corpInfo.name,
                ticker: corpInfo.ticker,
                member_count: corpInfo.member_count,
                ceo_id: corpInfo.ceo_id,
                creator_id: corpInfo.creator_id,
                date_founded: corpInfo.date_founded
                  ? new Date(corpInfo.date_founded)
                  : null,
                description: corpInfo.description,
                alliance_id: corpInfo.alliance_id, // ESI'den gelen değer direkt
                faction_id: corpInfo.faction_id,
                home_station_id: corpInfo.home_station_id,
                shares: corpInfo.shares,
                tax_rate: corpInfo.tax_rate,
                url: corpInfo.url,
              },
              update: {
                // ✅ Güncel bilgileri güncelle
                name: corpInfo.name,
                ticker: corpInfo.ticker,
                member_count: corpInfo.member_count,
                ceo_id: corpInfo.ceo_id,
                alliance_id: corpInfo.alliance_id, // ESI'den gelen değer direkt
                tax_rate: corpInfo.tax_rate,
                description: corpInfo.description,
                url: corpInfo.url,
                // date_founded, creator_id değişmez, güncellemeye gerek yok
              },
            });

            if (existing) {
              totalUpdated++;
              logger.info(
                `  ✅ [${totalProcessed + 1}][${corporationId}] ${corpInfo.name} [${corpInfo.ticker}] \x1b[36m(updated)\x1b[0m`,
              );
            } else {
              totalCreated++;
              logger.info(
                `  ✅ [${totalProcessed + 1}][${corporationId}] ${corpInfo.name} [${corpInfo.ticker}] \x1b[32m(created)\x1b[0m`,
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
              warn: (m) => logger.warn(`  ${m} (corporation ${corporationId})`),
              error: (m, e) =>
                logger.error(`  ${m} (corporation ${corporationId})`, e),
            });
          }
        },
        { noAck: false },
      );

      // Wait indefinitely unless connection fails
      await new Promise((resolve, reject) => {
        channel.on('error', reject);
        channel.on('close', reject);
      });
    } catch (error: any) {
      if (isShuttingDown) {
        logger.info('Worker stopped during shutdown');
        break;
      }

      logger.error('💥 Worker error:', error.message);

      if (emptyCheckInterval) {
        clearInterval(emptyCheckInterval);
        emptyCheckInterval = null;
      }

      // Wait before reconnecting
      logger.info('🔄 Reconnecting in 5 seconds...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  logger.info('Worker stopped');
  await prismaWorker.$disconnect();
}

function setupShutdownHandlers() {
  const shutdown = async () => {
    logger.warn('\n\n⚠️  Shutting down...');
    isShuttingDown = true;

    if (emptyCheckInterval) {
      clearInterval(emptyCheckInterval);
      emptyCheckInterval = null;
    }

    await prismaWorker.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

setupShutdownHandlers();
corporationInfoWorker();
