/**
 * Type Info Worker
 * Fetches type/item information from ESI and saves to database
 */

import '../config';
import logger from '../services/logger';
import prismaWorker from '../services/prisma-worker';
import { getRabbitMQChannel } from '../services/rabbitmq';
import { TypeService } from '../services/type';

const QUEUE_NAME = 'esi_type_info_queue';
const PREFETCH_COUNT = 10; // Process 10 types concurrently

interface EntityQueueMessage {
  entityId: number;
  queuedAt: string;
  source: string;
}

async function typeInfoWorker() {
  logger.info('📦 Type Info Worker Started');
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
    logger.info('⏳ Waiting for types...\n');

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
        const typeId = message.entityId;

        try {

          // Check if already exists
          const existing = await prismaWorker.type.findUnique({
            where: { id: typeId },
          });

          // Type'lar nadiren değişir ama yine de güncel bilgiyi çekelim
          if (existing) {
            // Type zaten var, skip (type'lar sabit veridir, güncellenmeye gerek yok)
            channel.ack(msg);
            totalSkipped++;
            totalProcessed++;
            logger.debug(`  - [${totalProcessed}] Type ${typeId} (exists)`);
            return;
          }

          // Fetch from ESI
          const typeInfo = await TypeService.getTypeInfo(typeId);

          // Save to database (upsert to prevent race condition)
          const result = await prismaWorker.type.upsert({
            where: { id: typeId },
            create: {
              id: typeId,
              name: typeInfo.name,
              description: typeInfo.description,
              group_id: typeInfo.group_id,
              published: typeInfo.published,
              volume: typeInfo.volume,
              capacity: typeInfo.capacity,
              mass: typeInfo.mass,
              icon_id: typeInfo.icon_id,
            },
            update: {}, // Type'lar statik veri, güncellenmez
          });

          totalAdded++;
          channel.ack(msg);
          totalProcessed++;
          logger.debug(`  ✓ [${totalProcessed}] ${typeInfo.name}`);

          if (totalProcessed % 100 === 0) {
            logger.info(`📊 Summary: ${totalProcessed} processed (${totalAdded} added, ${totalSkipped} skipped, ${totalErrors} errors)`);
          }
        } catch (error: any) {
          totalErrors++;
          totalProcessed++;

          if (error.message?.includes('404')) {
            logger.warn(`  ! [${totalProcessed}] Type ${message.entityId} (404)`);
            channel.ack(msg);
          } else {
            logger.error(`  × [${totalProcessed}] Type ${message.entityId}: ${error.message}`);
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
typeInfoWorker();
