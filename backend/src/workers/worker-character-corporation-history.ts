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

/**
 * One consume turn on `channel`, publishing through `confirmChannel`. It
 * lasts until either channel errors or closes, then rejects with the reason.
 * On the way out it cancels its consumer and closes the confirm channel:
 * rabbitmq.ts caches the consume channel and replaces it only when the
 * connection drops, so the next turn may consume on the same channel, and a
 * consumer left behind would take messages twice over.
 */
export async function runConsumeTurn(
  channel: amqp.Channel,
  confirmChannel: amqp.ConfirmChannel,
  onMessage: (msg: amqp.ConsumeMessage) => Promise<void>,
): Promise<never> {
  // Every concurrent sendEntitiesConfirmed listens on this channel; with
  // the prefetch above that is more than Node's default of 10.
  confirmChannel.setMaxListeners(0);
  const onConfirmError = (err: Error) =>
    logger.error('❌ confirm channel error:', err.message);
  confirmChannel.on('error', onConfirmError);

  let fail: (err: Error) => void = () => {};
  const failed = new Promise<never>((_, reject) => (fail = reject));
  const onChannelError = (err: Error) => {
    logger.error('❌ channel error:', err.message);
    fail(err);
  };
  const onChannelClose = () => {
    logger.warn('⚠️  channel closed');
    fail(new Error('channel closed'));
  };
  const onConfirmClose = () => {
    logger.warn('⚠️  confirm channel closed');
    fail(new Error('confirm channel closed'));
  };
  channel.on('error', onChannelError);
  channel.on('close', onChannelClose);
  confirmChannel.on('close', onConfirmClose);

  let consumerTag: string | undefined;
  try {
    ({ consumerTag } = await channel.consume(
      QUEUE_NAME,
      (msg) => (msg ? onMessage(msg) : undefined),
      { noAck: false },
    ));
    return await failed;
  } finally {
    channel.removeListener('error', onChannelError);
    channel.removeListener('close', onChannelClose);
    confirmChannel.removeListener('close', onConfirmClose);
    if (consumerTag) await channel.cancel(consumerTag).catch(() => {});
    await confirmChannel.close().catch(() => {});
    confirmChannel.removeListener('error', onConfirmError);
  }
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
      // The corporation messages go out on their own confirm channel, one per
      // turn. runConsumeTurn closes it, and cancels this turn's consumer,
      // whenever either channel fails.
      const confirmChannel = await getRabbitMQConfirmChannel();

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

      await runConsumeTurn(channel, confirmChannel, async (msg) => {
        lastMessageTime = Date.now();

        const message: EntityQueueMessage = JSON.parse(msg.content.toString());
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
