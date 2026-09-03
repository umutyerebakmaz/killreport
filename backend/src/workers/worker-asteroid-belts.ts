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

import { config } from '@config/config';
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
// Concurrency, not a rate limit - esiRateLimiter owns the dispatch ceiling.
// Its job is to keep that ceiling fed, so it has to be at least a fraction of
// the target rate. Override per run with ESI_PREFETCH.
const PREFETCH_COUNT = Math.max(
  config.esi.prefetch,
  Math.ceil(config.esi.maxRequestsPerSecond / 2),
);
/** Queue quiet for this long, with nothing in flight, means the run is done. */
const IDLE_EXIT_MS = 5000;

let emptyCheckInterval: NodeJS.Timeout | null = null;

async function asteroidBeltsWorker() {
  logger.info('🚀 Asteroid Belt Worker Started');
  logger.info(`📦 Queue: ${QUEUE_NAME}`);
  logger.info(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent`);
  logger.info(
    `🚦 ESI ceiling: ${config.esi.maxRequestsPerSecond} req/sec (ESI_MAX_RPS)\n`,
  );

  try {
    const channel = await getRabbitMQChannel();

    await assertTopologyQueue(channel, QUEUE_NAME);

    channel.prefetch(PREFETCH_COUNT);

    const queueInfo = await channel.checkQueue(QUEUE_NAME);
    logger.info(
      `📊 Queue status: ${queueInfo.messageCount} messages waiting\n`,
    );

    let processed = 0;
    let errors = 0;
    let inFlight = 0;
    let lastMessageTime = Date.now();
    const startTime = Date.now();

    // One exit path for both the idle check below and Ctrl+C.
    const shutdown = async (code: number): Promise<void> => {
      if (emptyCheckInterval) clearInterval(emptyCheckInterval);
      try {
        await channel.close();
      } catch {
        // Already closing; nothing to do.
      }
      await prismaWorker.$disconnect();
      logger.info('✅ Worker stopped gracefully');
      process.exit(code);
    };

    // Done means two things at once: nothing still in flight, and the queue
    // quiet for a full idle window. inFlight is what makes this safe to exit
    // on - with PREFETCH_COUNT > 1 the queue goes quiet while messages are
    // still being processed, and closing the channel then would requeue them
    // with their rows unwritten.
    emptyCheckInterval = setInterval(() => {
      if (inFlight > 0 || Date.now() - lastMessageTime <= IDLE_EXIT_MS) return;

      if (processed + errors === 0) {
        logger.info('💤 Nothing to do: the queue was already empty.');
      } else {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info('\n' + '='.repeat(60));
        logger.info('🎉 ALL TASKS COMPLETED!');
        logger.info(
          `✅ Processed: ${processed}   ❌ Errors: ${errors}   ⏱️  ${duration}s`,
        );
        logger.info('='.repeat(60));
      }

      void shutdown(errors > 0 ? 1 : 0);
    }, 1000);

    await channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (!msg) return;
        lastMessageTime = Date.now();
        inFlight++;

        try {
          const payload = parseTopologyMessage<AsteroidBeltMessage>(msg);

          if (!payload || typeof payload.beltId !== 'number') {
            logger.error(
              '❌ Invalid asteroid belt message:',
              msg.content.toString(),
            );
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
            logger.info(
              `  ✅ [${processed}] Asteroid belt ${beltId} - ${data.name ?? '(unnamed)'}`,
            );
            if (processed % 100 === 0) {
              logger.info(
                `📊 Progress: ${processed} processed, ${errors} errors`,
              );
            }
            channel.ack(msg);
          } catch (error: any) {
            errors++;
            if (error.response?.status === 404) {
              // A dead ID at ESI. The topology facts are still authoritative, so
              // write the row without a name rather than losing the belt entirely.
              logger.warn(
                `⚠️  Asteroid belt ${beltId} not found (404), writing row without a name`,
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
                await handleWorkerError(
                  channel,
                  msg,
                  payload,
                  QUEUE_NAME,
                  writeError,
                  logger,
                );
              }
            } else {
              await handleWorkerError(
                channel,
                msg,
                payload,
                QUEUE_NAME,
                error,
                logger,
              );
            }
          }
        } finally {
          inFlight--;
        }
      },
      { noAck: false },
    );

    // SIGTERM too, not just SIGINT: timeout(1) and PM2 both send SIGTERM,
    // and without it the channel dies mid-message instead of draining.
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.on(signal, () => {
        logger.warn(`\n🛑 ${signal} received, shutting down worker...`);
        void shutdown(0);
      });
    }
  } catch (error) {
    logger.error('❌ Failed to start asteroid belt worker:', error);
    process.exit(1);
  }
}

asteroidBeltsWorker();
