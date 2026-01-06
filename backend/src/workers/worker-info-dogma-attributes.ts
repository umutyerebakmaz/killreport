/**
 * Dogma Attribute Info Worker
 * Fetches dogma attribute information from ESI and saves to database
 */

import '../config';
import { DogmaAttributeService } from '../services/dogma';
import logger from '../services/logger';
import prismaWorker from '../services/prisma-worker';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_dogma_attribute_info_queue';
const PREFETCH_COUNT = 50; // Process 50 attributes concurrently (max ESI rate limit)

interface EntityQueueMessage {
  entityId: number;
  queuedAt: string;
  source: string;
}

async function dogmaAttributeInfoWorker() {
  logger.info('🔷 Dogma Attribute Info Worker Started');
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
    logger.info('⏳ Waiting for dogma attributes...\n');

    let totalProcessed = 0;
    let totalAdded = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let lastMessageTime = Date.now();

    // Check if queue is empty every 5 seconds
    const emptyCheckInterval = setInterval(async () => {
      const timeSinceLastMessage = Date.now() - lastMessageTime;
      if (timeSinceLastMessage > 5000 && totalProcessed > 0) {
        logger.info('\n' + '━'.repeat(60));
        logger.info('✅ Queue completed!');
        logger.info(`📊 Final: ${totalProcessed} processed (${totalAdded} added, ${totalSkipped} skipped, ${totalErrors} errors)`);
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
            logger.info(`  - [${totalProcessed}] Attribute ${attributeId} (exists)`);
            return;
          }

          // Fetch from ESI
          const attributeInfo = await DogmaAttributeService.getAttributeInfo(attributeId);

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
          logger.info(`  ✓ [${totalProcessed}] ${attributeInfo.name} (${attributeInfo.display_name || 'N/A'})`);

          if (totalProcessed % 100 === 0) {
            logger.info(`📊 Summary: ${totalProcessed} processed (${totalAdded} added, ${totalSkipped} skipped, ${totalErrors} errors)`);
          }
        } catch (error: any) {
          totalErrors++;
          totalProcessed++;

          if (error.message?.includes('404')) {
            logger.warn(`  ! [${totalProcessed}] Attribute ${message.entityId} (404)`);
            channel.ack(msg);
          } else {
            logger.error(`  × [${totalProcessed}] Attribute ${message.entityId}: ${error.message}`);
            channel.nack(msg, false, true);
          }

          if (totalProcessed % 100 === 0) {
            logger.info(`📊 Summary: ${totalProcessed} processed (${totalAdded} added, ${totalSkipped} skipped, ${totalErrors} errors)`);
          }
        }
      },
      { noAck: false }
    );

  } catch (error) {
    logger.error('💥 Worker failed to start:', error);
    await prismaWorker.$disconnect();
    process.exit(1);
  }
}

function setupShutdownHandlers() {
  const shutdown = async () => {
    logger.warn('\n\n⚠️  Shutting down...');
    await prismaWorker.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

setupShutdownHandlers();
dogmaAttributeInfoWorker();
