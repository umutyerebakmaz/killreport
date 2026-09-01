/**
 * Asteroid Belt Worker
 *
 * Sole writer of the asteroid_belts table.
 *
 * The response contains neither asteroid_belt_id nor planet_id; both travel in
 * the queue message, put there by worker-planets, which read the belt-to-planet
 * link out of the /universe/systems/{id}/ nesting. Nothing else can recover it.
 *
 * Single write: nothing depends on a belt row, and a second write would be pure
 * cost. A lost message is covered by the DLQ and by re-running the root scan.
 *
 * Usage: yarn worker:asteroid-belts
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getRabbitMQChannel } from '@services/rabbitmq';
import { UniverseService } from '@services/universe/universe.service';
import {
  assertTopologyQueue,
  handleWorkerError,
  parseTopologyMessage,
  type AsteroidBeltMessage,
} from '../queues/topology-messages';

const QUEUE_NAME = 'esi_asteroid_belts_queue';
// ESI throughput is capped at 50/sec by esiRateLimiter, so this is concurrency,
// not a rate limit. Matches worker-info-corporations.
const PREFETCH_COUNT = 25;

let emptyCheckInterval: NodeJS.Timeout | null = null;

async function asteroidBeltsWorker() {
  logger.info('🚀 Asteroid Belt Worker Started');
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

        const payload = parseTopologyMessage<AsteroidBeltMessage>(msg);

        if (!payload || typeof payload.beltId !== 'number') {
          logger.error('❌ Invalid asteroid belt message:', msg.content.toString());
          errors++;
          channel.ack(msg);
          return;
        }

        const { beltId, solarSystemId, planetId, orbitIndex } = payload;

        try {
          const data = await UniverseService.getAsteroidBelt(beltId);

          // upsert, not update: this worker creates the row now. The planet row
          // is guaranteed to exist because this message was published by
          // worker-planets after it wrote that row.
          const row = {
            solar_system_id: solarSystemId,
            planet_id: planetId,
            orbit_index: orbitIndex,
            name: data.name ?? null,
            position_x: data.position?.x ?? null,
            position_y: data.position?.y ?? null,
            position_z: data.position?.z ?? null,
          };

          await prismaWorker.asteroidBelt.upsert({
            where: { id: beltId },
            update: row,
            create: { id: beltId, ...row },
          });

          processed++;
          logger.debug(`✅ Asteroid belt ${beltId} - ${data.name ?? '(unnamed)'}`);
          channel.ack(msg);
        } catch (error: any) {
          errors++;
          if (error.response?.status === 404) {
            // A dead ID at ESI. The topology facts are still authoritative, so
            // write the row without a name rather than losing the belt entirely.
            logger.warn(
              `⚠️  Asteroid belt ${beltId} not found (404), writing row without a name`
            );
            try {
              await prismaWorker.asteroidBelt.upsert({
                where: { id: beltId },
                update: {
                  solar_system_id: solarSystemId,
                  planet_id: planetId,
                  orbit_index: orbitIndex,
                },
                create: {
                  id: beltId,
                  solar_system_id: solarSystemId,
                  planet_id: planetId,
                  orbit_index: orbitIndex,
                },
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
    logger.error('❌ Failed to start asteroid belt worker:', error);
    process.exit(1);
  }
}

asteroidBeltsWorker();
