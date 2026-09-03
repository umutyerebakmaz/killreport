/**
 * Character Info Worker
 * Fetches character information from ESI and saves to database
 */

import { CharacterService } from '@services/character';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getRabbitMQChannel } from '@services/rabbitmq';

const QUEUE_NAME = 'esi_character_info_queue';
const PREFETCH_COUNT = 5; // Process 5 characters concurrently (ESI rate limit protection)

interface EntityQueueMessage {
  entityId: number;
  queuedAt: string;
  source: string;
}

let isShuttingDown = false;
let emptyCheckInterval: NodeJS.Timeout | null = null;

async function characterInfoWorker() {
  logger.info('👤 Character Info Worker Started');
  logger.info(`📦 Queue: ${QUEUE_NAME}`);
  logger.info(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent\n`);

  while (!isShuttingDown) {
    try {
      const channel = await getRabbitMQChannel();

      await channel.assertQueue(QUEUE_NAME, {
        durable: true,
        arguments: { 'x-max-priority': 10 },
      });

      channel.prefetch(PREFETCH_COUNT);

      logger.info('✅ Connected to RabbitMQ');
      logger.info('⏳ Waiting for characters...\n');

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
          logger.info('✅ Queue completed!');
          logger.info(
            `📊 Final: ${totalProcessed} processed (${totalAdded} added, ${totalSkipped} skipped, ${totalErrors} errors)`,
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
          const characterId = message.entityId;

          try {
            // Check if already exists
            const existing = await prismaWorker.character.findUnique({
              where: { id: characterId },
            });

            // Fetch from ESI (her zaman güncel bilgiyi al)
            const charInfo =
              await CharacterService.getCharacterInfo(characterId);

            // Save to database (upsert to prevent race condition)
            await prismaWorker.character.upsert({
              where: { id: characterId },
              create: {
                id: characterId,
                name: charInfo.name,
                corporation_id: charInfo.corporation_id,
                alliance_id: charInfo.alliance_id, // ESI'den gelen değer direkt
                birthday: new Date(charInfo.birthday),
                bloodline_id: charInfo.bloodline_id,
                race_id: charInfo.race_id,
                gender: charInfo.gender,
                security_status: charInfo.security_status,
                description: charInfo.description,
                title: charInfo.title,
                faction_id: charInfo.faction_id,
              },
              update: {
                // Güncellenebilir alanlar
                corporation_id: charInfo.corporation_id,
                alliance_id: charInfo.alliance_id, // ESI'den gelen değer direkt
                security_status: charInfo.security_status,
                description: charInfo.description,
                title: charInfo.title,
                faction_id: charInfo.faction_id,
                // name, birthday, bloodline_id, race_id, gender değişmez
              },
            });

            if (existing) {
              totalSkipped++;
              logger.info(
                `  ↻ [${totalProcessed + 1}] ${charInfo.name} (updated)`,
              );
            } else {
              totalAdded++;
              logger.info(
                `  ✅ [${totalProcessed + 1}] ${charInfo.name} (created)`,
              );
            }

            channel.ack(msg);
            totalProcessed++;

            if (totalProcessed % 50 === 0) {
              logger.info(
                `📊 Summary: ${totalProcessed} processed (${totalAdded} added, ${totalSkipped} skipped, ${totalErrors} errors)`,
              );
            }
          } catch (error: any) {
            totalErrors++;
            totalProcessed++;

            // 404 = deleted character, don't requeue
            if (error.message?.includes('404')) {
              logger.warn(
                `  ! [${totalProcessed}] Character ${message.entityId} (404 - Deleted)`,
              );
              channel.ack(msg);
            } else {
              // Other errors: requeue
              logger.error(
                `  × [${totalProcessed}] Character ${message.entityId} ERROR:`,
              );
              logger.error(`     Message: ${error.message}`);
              logger.error(`     Stack: ${error.stack?.split('\n')[0]}`);
              channel.nack(msg, false, true);
            }

            if (totalProcessed % 50 === 0) {
              logger.info(
                `📊 Summary: ${totalProcessed} processed (${totalAdded} added, ${totalSkipped} skipped, ${totalErrors} errors)`,
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
characterInfoWorker();
