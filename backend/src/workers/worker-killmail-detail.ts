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
 * Kaç mesajın aynı anda elde tutulacağı. Gerçek ESI tavanı `esiRateLimiter`
 * tarafından tutulur (50 req/sn); bu sayı yalnızca unacked mesaj sayısıdır ve
 * bu worker'ın yazma yolu tek killmail'lik küçük bir transaction.
 */
const PREFETCH_COUNT = Number(process.env.ESI_PREFETCH ?? 10);

/**
 * Tek mesaj: public detay ucundan çek, yazıcıya ver.
 *
 * Dönüş, yazıcının dönüşüdür — `false` "zaten vardı" demektir ve bir hata
 * değildir: aynı killmail'i iki kaynak birden bulabilir.
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
 * Killmail detay worker'ı.
 *
 * Kaynaktan bağımsızdır: mesajı hangi liste aşamasının yayınladığını bilmez.
 * Kimlik bilgisi taşımaz, çünkü `/killmails/{id}/{hash}/` public bir uçtur.
 *
 * Usage: yarn worker:killmail-detail
 */
export async function killmailDetailWorker() {
  logger.info('🔄 Killmail Detail Worker Started');
  logger.info(`📦 Queue: ${QUEUE_NAME}`);
  logger.info(`⚡ Prefetch: ${PREFETCH_COUNT}`);

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

  logger.info(`📊 Ready to process messages from ${QUEUE_NAME}\n`);
}

if (require.main === module) {
  killmailDetailWorker().catch((error) => {
    logger.error('💥 Worker crashed:', error);
    process.exit(1);
  });
}
