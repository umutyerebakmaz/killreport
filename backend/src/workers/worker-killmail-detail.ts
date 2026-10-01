import type amqp from 'amqplib';
import {
  KILLMAIL_DETAIL_QUEUE,
  type KillmailDetailMessage,
} from '@services/killmail-detail-message';
import { saveKillmail } from '@services/killmail-writer';
import { KillmailService } from '@services/killmail/killmail.service';
import logger from '@services/logger';
import { ensureAllQueuesExist, getRabbitMQChannel } from '@services/rabbitmq';
import { handleWorkerError } from './worker-error';

const QUEUE_NAME = KILLMAIL_DETAIL_QUEUE;

/**
 * How many messages to hold at once.
 *
 * `ESI_PREFETCH` is deliberately not read. That knob exists for the ESI rate
 * ceiling and defaults to 100 in `config.ts`; what limits this worker is not ESI
 * but the workers' 2-connection Prisma pool (`prisma-worker.ts`). Every prefetched
 * message tries to write at once, and 100 concurrent writes on that pool hit
 * the 10-second connection timeout.
 */
const PREFETCH_COUNT = 10;

/**
 * One message: fetch from the public detail endpoint, hand it to the writer.
 *
 * Returns whatever the writer returns — `false` means "already there" and is
 * not an error: two sources can find the same killmail.
 */
export async function processDetailMessage(
  message: KillmailDetailMessage,
): Promise<boolean> {
  const detail = await KillmailService.getKillmailDetail(
    message.killmailId,
    message.killmailHash,
  );

  return saveKillmail(detail, message.killmailHash, {
    publish: message.announce,
  });
}

/**
 * Killmail detail worker.
 *
 * Source-agnostic: it does not know which list stage published the message.
 * It carries no credentials, because `/killmails/{id}/{hash}/` is public.
 *
 * Usage: yarn worker:killmail-detail
 */
export async function killmailDetailWorker() {
  logger.info('🔄 killmail detail worker started');
  logger.info(`📦 queue: ${QUEUE_NAME}`);
  logger.info(`⚡ prefetch: ${PREFETCH_COUNT}`);

  await ensureAllQueuesExist();
  const channel = await getRabbitMQChannel();
  channel.prefetch(PREFETCH_COUNT);

  await channel.consume(
    QUEUE_NAME,
    async (msg: amqp.ConsumeMessage | null) => {
      if (!msg) return;

      let message: KillmailDetailMessage | undefined;
      try {
        message = JSON.parse(msg.content.toString()) as KillmailDetailMessage;
        const saved = await processDetailMessage(message);
        logger.debug(
          `${saved ? '✅ saved' : '⏭️  already stored'}: ${message.killmailId}`,
        );
        channel.ack(msg);
      } catch (error) {
        // 404, the 420/429 backoff, the attempt count and parking all live in
        // the shared path. A killmail the writer refuses — no attackers —
        // lands there too and parks after five attempts, which is right: it
        // needs re-fetching, and parking is what makes it visible.
        await handleWorkerError(channel, msg, QUEUE_NAME, error, {
          warn: (m) => logger.warn(`  ${m} (killmail ${message?.killmailId})`),
          error: (m, e) =>
            logger.error(`  ${m} (killmail ${message?.killmailId})`, e),
        });
      }
    },
    { noAck: false },
  );

  logger.info(`📊 ready to process messages from ${QUEUE_NAME}\n`);
}

if (require.main === module) {
  killmailDetailWorker().catch((error) => {
    logger.error('💥 worker crashed:', error);
    process.exit(1);
  });
}
