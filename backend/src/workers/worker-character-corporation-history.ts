/**
 * Character Corporation History Worker
 * Fetches a character's corporation history from ESI and saves it to database
 */

import type amqp from 'amqplib';
import { config } from '@config/config';
import { CharacterService } from '@services/character';
import {
  findMissingCorporationIds,
  saveCorporationHistory,
} from '@services/character/character-corporation-history-writer';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import {
  ensureAllQueuesExist,
  getRabbitMQChannel,
  getRabbitMQConfirmChannel,
} from '@services/rabbitmq';
import { sendEntitiesConfirmed } from '../queues/publish-entities';
import { handleWorkerError } from './worker-error';

export const QUEUE_NAME = 'esi_character_corporation_history_queue';
const CORPORATION_QUEUE_NAME = 'esi_corporation_info_queue';
// Concurrency, not a rate limit - the shared limiter (esiLimiter) owns the dispatch ceiling.
// Its job is to keep that ceiling fed, so it has to be at least a fraction of
// the target rate. Override per run with ESI_PREFETCH.
const PREFETCH_COUNT = Math.max(
  config.esi.prefetch,
  Math.ceil(config.esi.maxRequestsPerSecond / 2),
);

const SOURCE = 'worker-character-corporation-history';

interface EntityQueueMessage {
  entityId: number;
  queuedAt: string;
  source: string;
}

let isShuttingDown = false;
let emptyCheckInterval: NodeJS.Timeout | null = null;

/**
 * Fetches and saves one character's history, then queues the corporations
 * that are not in the database yet so their names get resolved. Resolves
 * only once the broker has confirmed those messages: the caller acks the
 * character after this, so a crash in between can no longer lose them.
 */
export async function processCharacter(
  channel: amqp.ConfirmChannel,
  characterId: number,
): Promise<{ records: number; missingCorporations: number }> {
  const records = await CharacterService.getCorporationHistory(characterId);
  await saveCorporationHistory(characterId, records, new Date());

  const missing = await findMissingCorporationIds(
    records.map((r) => r.corporation_id),
  );
  if (missing.length > 0) {
    await sendEntitiesConfirmed(
      channel,
      CORPORATION_QUEUE_NAME,
      SOURCE,
      missing,
    );
  }

  return { records: records.length, missingCorporations: missing.length };
}

async function characterCorporationHistoryWorker() {
  logger.info('🏢 character corporation history worker started');
  logger.info(`📦 queue: ${QUEUE_NAME}`);
  logger.info(`⚡ prefetch: ${PREFETCH_COUNT} concurrent`);
  logger.info(
    `🚦 ESI ceiling: ${config.esi.maxRequestsPerSecond} req/sec (ESI_MAX_RPS)\n`,
  );

  await ensureAllQueuesExist();
  while (!isShuttingDown) {
    try {
      const channel = await getRabbitMQChannel();
      // The corporation messages go out on their own confirm channel, kept
      // for this connection's lifetime. If it closes on its own it is
      // reopened in place: tearing the turn down would consume a second time
      // on the cached consume channel, which is still open. A message caught
      // in the gap fails its send and goes down handleWorkerError.
      let turnOver = false;
      // A dropped connection closes both channels; this one going too means
      // the whole turn is over and the outer loop reconnects instead.
      channel.once('close', () => (turnOver = true));
      const openConfirmChannel = async (): Promise<amqp.ConfirmChannel> => {
        const ch = await getRabbitMQConfirmChannel();
        ch.on('error', (err) =>
          logger.error('❌ confirm channel error:', err.message),
        );
        ch.once('close', () =>
          // Wait for every close event of a dropped connection to land first
          setImmediate(() => {
            if (turnOver || isShuttingDown) return;
            logger.warn('⚠️  confirm channel closed, reopening');
            openConfirmChannel()
              .then((next) => (confirmChannel = next))
              .catch((err) =>
                logger.error(
                  '❌ could not reopen confirm channel:',
                  err.message,
                ),
              );
          }),
        );
        return ch;
      };
      let confirmChannel = await openConfirmChannel();

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
              confirmChannel,
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

      // Wait indefinitely unless the connection fails
      try {
        await new Promise((resolve, reject) => {
          channel.on('error', reject);
          channel.on('close', reject);
        });
      } finally {
        turnOver = true;
        await confirmChannel.close().catch(() => {});
      }
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
