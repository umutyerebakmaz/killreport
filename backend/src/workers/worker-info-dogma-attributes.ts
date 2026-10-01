/**
 * Dogma Attribute Info Worker
 * Fetches dogma attribute information from ESI and saves to database
 */

import { DogmaAttributeService } from '@services/dogma';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { ensureAllQueuesExist, getRabbitMQChannel } from '@services/rabbitmq';
import { handleWorkerError } from './worker-error';

const QUEUE_NAME = 'esi_dogma_attribute_info_queue';
const PREFETCH_COUNT = 50; // Process 50 attributes concurrently (max ESI rate limit)

interface EntityQueueMessage {
  entityId: number;
  queuedAt: string;
  source: string;
}

let isShuttingDown = false;
let emptyCheckInterval: NodeJS.Timeout | null = null;

async function dogmaAttributeInfoWorker() {
  logger.info('🔷 dogma attribute info worker started');
  logger.info(`📦 queue: ${QUEUE_NAME}`);
  logger.info(`⚡ prefetch: ${PREFETCH_COUNT} concurrent\n`);

  await ensureAllQueuesExist();
  while (!isShuttingDown) {
    try {
      const channel = await getRabbitMQChannel();

      channel.prefetch(PREFETCH_COUNT);

      // Handle channel errors
      channel.on('error', (err) => {
        logger.error('❌ channel error:', err.message);
        if (emptyCheckInterval) {
          clearInterval(emptyCheckInterval);
          emptyCheckInterval = null;
        }
      });

      channel.on('close', () => {
        logger.warn('⚠️  channel closed');
        if (emptyCheckInterval) {
          clearInterval(emptyCheckInterval);
          emptyCheckInterval = null;
        }
      });

      logger.info('✅ connected to RabbitMQ');
      logger.info('⏳ waiting for dogma attributes...\n');

      let totalProcessed = 0;
      let totalAdded = 0;
      let totalSkipped = 0;
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
          logger.info('✅ queue completed!');
          logger.info(
            `📊 final: ${totalProcessed} processed (${totalAdded} added, ${totalSkipped} skipped, ${totalErrors} errors)`,
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

          const message: EntityQueueMessage = JSON.parse(
            msg.content.toString(),
          );
          const attributeId = message.entityId;

          try {
            // Check if already exists
            const existing = await prismaWorker.dogmaAttribute.findUnique({
              where: { id: attributeId },
            });

            // Dogma attributes are static data, but we'll fetch to ensure completeness
            if (existing) {
              // Attribute already exists, skip (dogma attributes are static data)
              channel.ack(msg);
              totalSkipped++;
              totalProcessed++;
              logger.info(
                `  - [${totalProcessed}] attribute ${attributeId} (exists)`,
              );
              return;
            }

            // Fetch from ESI
            const attributeInfo =
              await DogmaAttributeService.getAttributeInfo(attributeId);

            // Save to database (upsert to prevent race condition)
            const result = await prismaWorker.dogmaAttribute.upsert({
              where: { id: attributeId },
              create: {
                id: attributeId,
                name: attributeInfo.name,
                display_name: attributeInfo.display_name || null,
                description: attributeInfo.description || null,
                unit_id: attributeInfo.unit_id || null,
                icon_id: attributeInfo.icon_id || null,
                default_value: attributeInfo.default_value || null,
                published: attributeInfo.published ?? true,
                stackable: attributeInfo.stackable ?? false,
                high_is_good: attributeInfo.high_is_good ?? false,
              },
              update: {}, // Dogma attributes are static data, no updates needed
            });

            totalAdded++;
            channel.ack(msg);
            totalProcessed++;
            logger.info(
              `  ✓ [${totalProcessed}] ${attributeInfo.name} (${attributeInfo.display_name || 'N/A'})`,
            );

            if (totalProcessed % 100 === 0) {
              logger.info(
                `📊 summary: ${totalProcessed} processed (${totalAdded} added, ${totalSkipped} skipped, ${totalErrors} errors)`,
              );
            }
          } catch (error) {
            totalErrors++;
            totalProcessed++;
            // 404, the 420 backoff and the attempt count all live in the
            // shared path now; this worker only says which message it was.
            await handleWorkerError(channel, msg, QUEUE_NAME, error, {
              warn: (m) => logger.warn(`  ${m} (attribute ${attributeId})`),
              error: (m, e) =>
                logger.error(`  ${m} (attribute ${attributeId})`, e),
            });

            if (totalProcessed % 100 === 0) {
              logger.info(
                `📊 summary: ${totalProcessed} processed (${totalAdded} added, ${totalSkipped} skipped, ${totalErrors} errors)`,
              );
            }
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
        logger.info('worker stopped during shutdown');
        break;
      }

      logger.error('💥 worker error:', error.message);

      if (emptyCheckInterval) {
        clearInterval(emptyCheckInterval);
        emptyCheckInterval = null;
      }

      // Wait before reconnecting
      logger.info('🔄 reconnecting in 5 seconds...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  logger.info('worker stopped');
  await prismaWorker.$disconnect();
}

function setupShutdownHandlers() {
  const shutdown = async () => {
    logger.warn('\n\n⚠️  shutting down...');
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
dogmaAttributeInfoWorker();
