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
// ESI throughput is capped at 50/sec by esiRateLimiter, so this is concurrency,
// not a rate limit. Matches worker-info-corporations.
const PREFETCH_COUNT = 25;

let emptyCheckInterval: NodeJS.Timeout | null = null;

async function planetsWorker() {
  logger.info('🚀 Planet Worker Started');
  logger.info(`📦 Queue: ${QUEUE_NAME}`);
  logger.info(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent\n`);

  try {
    const channel = await getRabbitMQChannel();

    await assertTopologyQueue(channel, QUEUE_NAME);
    await assertTopologyQueue(channel, TOPOLOGY_QUEUES.moons);
    await assertTopologyQueue(channel, TOPOLOGY_QUEUES.asteroidBelts);

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

        const payload = parseTopologyMessage<PlanetMessage>(msg);

        if (!payload || typeof payload.planetId !== 'number') {
          logger.error('❌ Invalid planet message:', msg.content.toString());
          errors++;
          channel.ack(msg);
          return;
        }

        const { planetId, solarSystemId, orbitIndex, moonIds, asteroidBeltIds } = payload;

        try {
          // 1. Write the row from the message. Everything here is authoritative:
          //    orbit_index encodes the ordering of the planets[] array and has no
          //    equivalent field in the by-ID response.
          await prismaWorker.planet.upsert({
            where: { id: planetId },
            update: { solar_system_id: solarSystemId, orbit_index: orbitIndex },
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
          logger.debug(
            `✅ Planet ${planetId} - ${data.name ?? '(unnamed)'} ` +
              `(${moonIds?.length ?? 0} moons, ${asteroidBeltIds?.length ?? 0} belts queued)`
          );
          channel.ack(msg);
        } catch (error: any) {
          errors++;
          if (error.response?.status === 404) {
            // A dead ID at the ESI step. The row and the chain already exist, so
            // ack: the row keeps its NULL name and shows up in the repair scan.
            logger.warn(`⚠️  Planet ${planetId} not found (404)`);
            channel.ack(msg);
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
    logger.error('❌ Failed to start planet worker:', error);
    process.exit(1);
  }
}

planetsWorker();
