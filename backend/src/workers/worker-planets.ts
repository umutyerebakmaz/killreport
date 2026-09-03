/**
 * Planet Worker
 *
 * The middle node of the celestial chain. It is the only writer of the planets
 * table.
 *
 * Order matters and is not arbitrary:
 *   1. upsert the row from the message alone (id, solar_system_id, orbit_index
 *      are all authoritative there),
 *   2. publish the moon and asteroid belt messages,
 *   3. enrich from /universe/planets/{id}/.
 *
 * A failed ESI call therefore costs a name, not the row and not the chain. The
 * repair script finds what is missing with WHERE name IS NULL.
 *
 * Moons and belts chain through here rather than being fanned out by the system
 * worker because their planet_id is NOT NULL with a foreign key to planets, and
 * RabbitMQ guarantees no ordering across queues.
 *
 * Usage: yarn worker:planets
 */

import { config } from '@config/config';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getRabbitMQChannel } from '@services/rabbitmq';
import { UniverseService } from '@services/universe/universe.service';
import {
  TOPOLOGY_QUEUES,
  assertTopologyQueue,
  envelope,
  handleWorkerError,
  parseTopologyMessage,
  publishTopology,
  type PlanetMessage,
} from '../queues/topology-messages';

const QUEUE_NAME = 'esi_planets_queue';
const SOURCE = 'worker-planets';
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

async function planetsWorker() {
  logger.info('🚀 Planet Worker Started');
  logger.info(`📦 Queue: ${QUEUE_NAME}`);
  logger.info(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent`);
  logger.info(
    `🚦 ESI ceiling: ${config.esi.maxRequestsPerSecond} req/sec (ESI_MAX_RPS)\n`,
  );

  try {
    const channel = await getRabbitMQChannel();

    await assertTopologyQueue(channel, QUEUE_NAME);
    await assertTopologyQueue(channel, TOPOLOGY_QUEUES.moons);
    await assertTopologyQueue(channel, TOPOLOGY_QUEUES.asteroidBelts);

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
        logger.info(
          '\n💡 Moons and asteroid belts are queued now - run their workers next.\n',
        );
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
          const payload = parseTopologyMessage<PlanetMessage>(msg);

          if (!payload || typeof payload.planetId !== 'number') {
            logger.error('❌ Invalid planet message:', msg.content.toString());
            errors++;
            channel.ack(msg);
            return;
          }

          const {
            planetId,
            solarSystemId,
            orbitIndex,
            moonIds,
            asteroidBeltIds,
          } = payload;

          try {
            // 1. Write the row from the message. Everything here is authoritative:
            //    orbit_index encodes the ordering of the planets[] array and has no
            //    equivalent field in the by-ID response.
            await prismaWorker.planet.upsert({
              where: { id: planetId },
              update: {
                solar_system_id: solarSystemId,
                orbit_index: orbitIndex,
              },
              create: {
                id: planetId,
                solar_system_id: solarSystemId,
                orbit_index: orbitIndex,
              },
            });

            // 2. Publish the children. The planet row now exists, so their
            //    (planet_id, solar_system_id) foreign key can be satisfied.
            for (let m = 0; m < (moonIds ?? []).length; m++) {
              publishTopology(channel, TOPOLOGY_QUEUES.moons, {
                ...envelope(SOURCE),
                moonId: moonIds[m],
                solarSystemId,
                planetId,
                orbitIndex: m + 1,
              });
            }

            for (let b = 0; b < (asteroidBeltIds ?? []).length; b++) {
              publishTopology(channel, TOPOLOGY_QUEUES.asteroidBelts, {
                ...envelope(SOURCE),
                beltId: asteroidBeltIds[b],
                solarSystemId,
                planetId,
                orbitIndex: b + 1,
              });
            }

            // 3. Enrich. Anything that fails from here on costs a name only.
            const data = await UniverseService.getPlanet(planetId);

            await prismaWorker.planet.update({
              where: { id: planetId },
              data: {
                name: data.name ?? null,
                type_id: data.type_id ?? null,
                position_x: data.position?.x ?? null,
                position_y: data.position?.y ?? null,
                position_z: data.position?.z ?? null,
              },
            });

            processed++;
            logger.info(
              `  ✅ [${processed}] Planet ${planetId} - ${data.name ?? '(unnamed)'} ` +
                `(${moonIds?.length ?? 0} moons, ${asteroidBeltIds?.length ?? 0} belts queued)`,
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
              // A dead ID at the ESI step. The row and the chain already exist, so
              // ack: the row keeps its NULL name and shows up in the repair scan.
              logger.warn(`⚠️  Planet ${planetId} not found (404)`);
              channel.ack(msg);
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
    logger.error('❌ Failed to start planet worker:', error);
    process.exit(1);
  }
}

planetsWorker();
