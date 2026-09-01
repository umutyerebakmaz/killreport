/**
 * Star Worker
 *
 * Sole writer of the stars table.
 *
 * /universe/stars/{id}/ does not echo the star's own id and does not return the
 * system it belongs to, so both travel in the queue message, published by
 * worker-solar-systems out of the system response's star_id.
 *
 * stars.solar_system_id is UNIQUE - one star per system. A second star for the
 * same system raises P2002, which is not retryable and ends up in the DLQ after
 * five attempts. That is deliberate: ESI reporting two stars for one system is a
 * real data fault and should be visible, not silently absorbed.
 *
 * Usage: yarn worker:stars
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getRabbitMQChannel } from '@services/rabbitmq';
import { UniverseService } from '@services/universe/universe.service';
import {
  assertTopologyQueue,
  handleWorkerError,
  parseTopologyMessage,
  type StarMessage,
} from '../queues/topology-messages';

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

    await assertTopologyQueue(channel, QUEUE_NAME);

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

        const payload = parseTopologyMessage<StarMessage>(msg);

        if (!payload || typeof payload.starId !== 'number') {
          logger.error('❌ Invalid star message:', msg.content.toString());
          errors++;
          channel.ack(msg);
          return;
        }

        const { starId, solarSystemId } = payload;

        try {
          const data = await UniverseService.getStar(starId);

          const row = {
            solar_system_id: solarSystemId,
            name: data.name ?? null,
            type_id: data.type_id ?? null,
            spectral_class: data.spectral_class ?? null,
            temperature: data.temperature ?? null,
            radius: data.radius ?? null,
            age: data.age ?? null,
            luminosity: data.luminosity ?? null,
          };

          await prismaWorker.star.upsert({
            where: { id: starId },
            update: row,
            create: { id: starId, ...row },
          });

          processed++;
          logger.debug(`✅ Star ${starId} - ${data.name ?? '(unnamed)'}`);
          channel.ack(msg);
        } catch (error: any) {
          errors++;
          if (error.response?.status === 404) {
            // A dead ID at ESI. The topology fact - this system has this star -
            // is still authoritative, so write the row without a name.
            logger.warn(`⚠️  Star ${starId} not found (404), writing row without a name`);
            try {
              await prismaWorker.star.upsert({
                where: { id: starId },
                update: { solar_system_id: solarSystemId },
                create: { id: starId, solar_system_id: solarSystemId },
              });
              channel.ack(msg);
            } catch (writeError: any) {
              await handleWorkerError(channel, msg, payload, QUEUE_NAME, writeError, logger);
            }
          } else {
            await handleWorkerError(channel, msg, payload, QUEUE_NAME, error, logger);
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

starsWorker();
