/**
 * Star Worker
 *
 * Resolves /universe/stars/{id}/ into the stars table.
 *
 * NOTE: the response contains no star_id and no position. The update key comes
 * from the queue message; a star sits at the centre of its system.
 *
 * Usage: yarn worker:stars
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getRabbitMQChannel } from '@services/rabbitmq';
import { UniverseService } from '@services/universe/universe.service';

const QUEUE_NAME = 'esi_stars_queue';
// ESI throughput is capped at 50/sec by esiRateLimiter, so this is concurrency,
// not a rate limit. Matches worker-info-corporations.
const PREFETCH_COUNT = 25;

let emptyCheckInterval: NodeJS.Timeout | null = null;

async function starsWorker() {
  logger.info('🚀 Star Worker Started');
  logger.info(`📦 Queue: ${QUEUE_NAME}`);
  logger.info(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent\n`);

  try {
    const channel = await getRabbitMQChannel();

    // x-max-priority is mandatory: server.ts's ensureAllQueuesExist() declares
    // every queue with it, and omitting it fails with 406 PRECONDITION_FAILED.
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: { 'x-max-priority': 10 },
    });

    channel.prefetch(PREFETCH_COUNT);

    const queueInfo = await channel.checkQueue(QUEUE_NAME);
    logger.info(`📊 Queue status: ${queueInfo.messageCount} messages waiting\n`);

    let processed = 0;
    let errors = 0;
    let lastMessageTime = Date.now();
    const startTime = Date.now();

    // With PREFETCH_COUNT > 1, checkQueue() races the in-flight messages, so
    // completion is detected by the queue going quiet instead.
    emptyCheckInterval = setInterval(() => {
      if (Date.now() - lastMessageTime > 5000 && processed + errors > 0) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info('\n' + '='.repeat(60));
        logger.info('🎉 ALL TASKS COMPLETED!');
        logger.info(`✅ Processed: ${processed}   ❌ Errors: ${errors}   ⏱️  ${duration}s`);
        logger.info('='.repeat(60));
        logger.info('\n💡 Waiting for new messages... Press CTRL+C to stop.\n');
        processed = 0;
        errors = 0;
      }
    }, 5000);

    await channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (!msg) return;
        lastMessageTime = Date.now();

        // The key comes from the queue message, not the response body: the star
        // and asteroid belt endpoints do not echo their own ID.
        const id = parseInt(msg.content.toString());

        if (isNaN(id)) {
          logger.error('❌ Invalid star ID:', msg.content.toString());
          errors++;
          channel.ack(msg);
          return;
        }

        try {
          const data = await UniverseService.getStar(id);

          // update, not upsert: step 2 created the row, and the queue read it
          // from the database, so it exists. A missing row is a real error.
          await prismaWorker.star.update({
            where: { id },
            data: {
              name: data.name ?? null,
              type_id: data.type_id ?? null,
              spectral_class: data.spectral_class ?? null,
              temperature: data.temperature ?? null,
              radius: data.radius ?? null,
              age: data.age ?? null,
              luminosity: data.luminosity ?? null,
            },
          });

          processed++;
          logger.debug(`✅ Star ${id} - ${data.name ?? '(unnamed)'}`);
          channel.ack(msg);
        } catch (error: any) {
          errors++;
          if (error.response?.status === 404) {
            // A dead ID. Ack it: requeueing would loop forever, and the row keeps
            // its NULL name so it still shows in the completeness check.
            logger.warn(`⚠️  Star ${id} not found (404)`);
            channel.ack(msg);
          } else if (error.response?.status === 420) {
            logger.warn('🛑 Error limited (420)! Waiting 60 seconds...');
            await sleep(60000);
            channel.nack(msg, false, true); // requeue
          } else {
            logger.error(`❌ Error processing star ${id}:`, error.message);
            channel.nack(msg, false, false);
          }
        }
      },
      { noAck: false }
    );

    process.on('SIGINT', async () => {
      logger.warn('\n🛑 Shutting down worker...');
      if (emptyCheckInterval) clearInterval(emptyCheckInterval);
      await channel.close();
      await prismaWorker.$disconnect();
      logger.info('✅ Worker stopped gracefully');
      process.exit(0);
    });
  } catch (error) {
    logger.error('❌ Failed to start star worker:', error);
    process.exit(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

starsWorker();
