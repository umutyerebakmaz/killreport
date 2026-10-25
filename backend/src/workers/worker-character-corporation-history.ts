/**
 * Character Corporation History Worker
 * Fetches a character's corporation history from ESI and saves it to database
 */

import type amqp from 'amqplib';
import { CharacterService } from '@services/character';
import {
  findMissingCorporationIds,
  saveCorporationHistory,
} from '@services/character/character-corporation-history-writer';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { ensureAllQueuesExist, getRabbitMQChannel } from '@services/rabbitmq';
import { handleWorkerError } from './worker-error';

export const QUEUE_NAME = 'esi_character_corporation_history_queue';
const CORPORATION_QUEUE_NAME = 'esi_corporation_info_queue';
const PREFETCH_COUNT = 5; // Process 5 characters concurrently (ESI rate limit protection)

interface EntityQueueMessage {
  entityId: number;
  queuedAt: string;
  source: string;
}

let isShuttingDown = false;
let emptyCheckInterval: NodeJS.Timeout | null = null;

/**
 * Fetches and saves one character's history, then queues the corporations
 * that are not in the database yet so their names get resolved.
 */
export async function processCharacter(
  channel: amqp.Channel,
  characterId: number,
): Promise<{ records: number; missingCorporations: number }> {
  const records = await CharacterService.getCorporationHistory(characterId);
  await saveCorporationHistory(characterId, records, new Date());

  const missing = await findMissingCorporationIds(
    records.map((r) => r.corporation_id),
  );
  for (const corporationId of missing) {
    const message: EntityQueueMessage = {
      entityId: corporationId,
      queuedAt: new Date().toISOString(),
      source: 'worker-character-corporation-history',
    };
    channel.sendToQueue(
      CORPORATION_QUEUE_NAME,
      Buffer.from(JSON.stringify(message)),
      { persistent: true },
    );
  }

  return { records: records.length, missingCorporations: missing.length };
}

async function characterCorporationHistoryWorker() {
  logger.info('🏢 character corporation history worker started');
  logger.info(`📦 queue: ${QUEUE_NAME}`);
  logger.info(`⚡ prefetch: ${PREFETCH_COUNT} concurrent\n`);

  await ensureAllQueuesExist();
  while (!isShuttingDown) {
    try {
      const channel = await getRabbitMQChannel();

      channel.prefetch(PREFETCH_COUNT);

      logger.info('✅ connected to RabbitMQ');
      logger.info('⏳ waiting for characters...\n');

      let totalProcessed = 0;
      let totalErrors = 0;
      let lastMessageTime = Date.now();

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
            `📊 final: ${totalProcessed} processed (${totalErrors} errors)`,
          );
          logger.info('━'.repeat(60) + '\n');
          logger.info('⏳ waiting for new messages...\n');
        }
      }, 5000);

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
            const { records, missingCorporations } = await processCharacter(
              channel,
              characterId,
            );

            logger.info(
              `  ✅ [${totalProcessed + 1}] character ${characterId}: ${records} records, ${missingCorporations} corporations queued`,
            );

            channel.ack(msg);
            totalProcessed++;
          } catch (error) {
            totalErrors++;
            totalProcessed++;
            await handleWorkerError(channel, msg, QUEUE_NAME, error, {
              warn: (m) => logger.warn(`  ${m} (character ${characterId})`),
              error: (m, e) =>
                logger.error(`  ${m} (character ${characterId})`, e),
            });
          }

          if (totalProcessed % 50 === 0) {
            logger.info(
              `📊 summary: ${totalProcessed} processed (${totalErrors} errors)`,
            );
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

// Start the worker only if run directly (not imported)
if (require.main === module) {
  setupShutdownHandlers();
  characterCorporationHistoryWorker();
}
