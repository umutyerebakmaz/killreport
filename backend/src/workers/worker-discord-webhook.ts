import type amqp from 'amqplib';
import {
  DISCORD_WEBHOOK_QUEUE,
  type DiscordWebhookMessage,
} from '@services/discord-webhook/discord-webhook-message';
import { deliverKillmail } from '@services/discord-webhook/discord-delivery';
import logger from '@services/logger';
import { ensureAllQueuesExist, getRabbitMQChannel } from '@services/rabbitmq';
import { handleWorkerError } from './worker-error';

const QUEUE_NAME = DISCORD_WEBHOOK_QUEUE;

/**
 * How many messages to hold at once. Each one is a few queries and a handful
 * of Discord posts, so the limits are the workers' 2-connection Prisma pool
 * (`prisma-worker.ts`) and Discord's own rate limits, not ESI.
 */
const PREFETCH_COUNT = 5;

/**
 * Discord webhook worker.
 *
 * One message per freshly saved killmail. `deliverKillmail` decides whether
 * any webhook matches and posts to each. It throws only for transient
 * failures, which take the shared retry path. The webhook URL never reaches
 * a log line from here.
 *
 * Usage: yarn worker:discord-webhook
 */
export async function discordWebhookWorker(): Promise<void> {
  logger.info('🔄 discord webhook worker started');
  logger.info(`📦 queue: ${QUEUE_NAME}`);
  logger.info(`⚡ prefetch: ${PREFETCH_COUNT}`);

  await ensureAllQueuesExist();
  const channel = await getRabbitMQChannel();
  channel.prefetch(PREFETCH_COUNT);

  await channel.consume(
    QUEUE_NAME,
    async (msg: amqp.ConsumeMessage | null) => {
      if (!msg) return;

      let message: DiscordWebhookMessage | undefined;
      try {
        message = JSON.parse(msg.content.toString()) as DiscordWebhookMessage;
        await deliverKillmail(message.killmailId);
        logger.debug(`✅ discord delivery done: ${message.killmailId}`);
        channel.ack(msg);
      } catch (error) {
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
  discordWebhookWorker().catch((error) => {
    logger.error('💥 worker crashed:', error);
    process.exit(1);
  });
}
