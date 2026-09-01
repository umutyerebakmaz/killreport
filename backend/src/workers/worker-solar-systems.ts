/**
 * Solar System Worker
 *
 * Writes exactly one table - solar_systems - and publishes the celestial IDs the
 * same ESI response already contains onto their own queues.
 *
 * This is a root scanner: it never skips a message. The "already in the
 * database?" filter belongs to the repair queues, exactly as queue-alliances
 * (unfiltered) and queue-alliance-corporation-characters (filtered) are split.
 *
 * The planet message carries moonIds and asteroidBeltIds because the
 * planet -> moon / belt nesting exists ONLY in this response: neither
 * /universe/moons/{id}/ nor /universe/asteroid_belts/{id}/ returns planet_id. If
 * the chain does not carry it, it is unrecoverable.
 *
 * Usage: yarn worker:solar-systems
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getRabbitMQChannel } from '@services/rabbitmq';
import { SolarSystemService } from '@services/solar-system/solar-system.service';
import {
  TOPOLOGY_QUEUES,
  assertTopologyQueue,
  envelope,
  publishTopology,
} from '../queues/topology-messages';
import type amqp from 'amqplib';

const QUEUE_NAME = 'esi_solar_systems_queue';
const SOURCE = 'worker-solar-systems';
// ESI throughput is capped at 50/sec by esiRateLimiter, so this is concurrency,
// not a rate limit. The old prefetch(1) plus a manual 100ms sleep existed only
// because of the six-table transaction this worker no longer runs.
const PREFETCH_COUNT = 25;

interface EsiPlanet {
  planet_id: number;
  moons?: number[];
  asteroid_belts?: number[];
}

let emptyCheckInterval: NodeJS.Timeout | null = null;

async function processSolarSystem(
  channel: amqp.Channel,
  systemId: number
): Promise<void> {
  const data = await SolarSystemService.getSystemInfo(systemId);

  // Every one of these keys can be absent from the response, not merely empty:
  // 4-HWWF has no `stations`, Thera has no `stargates` and no `security_class`,
  // and Jita has planets with no `asteroid_belts`.
  const stargateIds: number[] = data.stargates ?? [];
  const stationIds: number[] = data.stations ?? [];
  const planets: EsiPlanet[] = data.planets ?? [];
  const starId: number | null = data.star_id ?? null;

  const systemRow = {
    name: data.name,
    constellation_id: data.constellation_id ?? null,
    security_status: data.security_status ?? null,
    security_class: data.security_class ?? null,
    star_id: starId,
    position_x: data.position?.x ?? null,
    position_y: data.position?.y ?? null,
    position_z: data.position?.z ?? null,
  };

  // One row, one table, no transaction. Every other table in the topology has a
  // single writer of its own now.
  await prismaWorker.solarSystem.upsert({
    where: { id: systemId },
    update: systemRow,
    create: { id: systemId, ...systemRow },
  });

  if (starId !== null) {
    publishTopology(channel, TOPOLOGY_QUEUES.stars, {
      ...envelope(SOURCE),
      starId,
      solarSystemId: systemId,
    });
  }

  for (const stargateId of stargateIds) {
    publishTopology(channel, TOPOLOGY_QUEUES.stargates, {
      ...envelope(SOURCE),
      stargateId,
      solarSystemId: systemId,
    });
  }

  for (const stationId of stationIds) {
    publishTopology(channel, TOPOLOGY_QUEUES.stations, {
      ...envelope(SOURCE),
      stationId,
      solarSystemId: systemId,
    });
  }

  for (let p = 0; p < planets.length; p++) {
    const planet = planets[p];
    publishTopology(channel, TOPOLOGY_QUEUES.planets, {
      ...envelope(SOURCE),
      planetId: planet.planet_id,
      solarSystemId: systemId,
      orbitIndex: p + 1,
      moonIds: planet.moons ?? [],
      asteroidBeltIds: planet.asteroid_belts ?? [],
    });
  }

  const moonCount = planets.reduce((n, p) => n + (p.moons?.length ?? 0), 0);
  const beltCount = planets.reduce((n, p) => n + (p.asteroid_belts?.length ?? 0), 0);
  logger.debug(
    `✅ Solar system ${systemId} - ${data.name} ` +
      `(${stargateIds.length} gates, ${stationIds.length} stations, ` +
      `${planets.length} planets -> ${moonCount} moons, ${beltCount} belts queued)`
  );
}

async function startWorker() {
  logger.info('🚀 Solar System Worker Started');
  logger.info(`📦 Queue: ${QUEUE_NAME}`);
  logger.info(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent\n`);

  try {
    const channel = await getRabbitMQChannel();

    await assertTopologyQueue(channel, QUEUE_NAME);
    // Declare the downstream queues too, so a fresh environment does not lose
    // the first publish of a run.
    await assertTopologyQueue(channel, TOPOLOGY_QUEUES.stars);
    await assertTopologyQueue(channel, TOPOLOGY_QUEUES.stargates);
    await assertTopologyQueue(channel, TOPOLOGY_QUEUES.stations);
    await assertTopologyQueue(channel, TOPOLOGY_QUEUES.planets);

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
        logger.info('\n💡 The system queue is empty, but the chain is not done ');
        logger.info('   until stars, stargates, stations, planets, moons and ');
        logger.info('   asteroid belts are all empty too.\n');
        processed = 0;
        errors = 0;
      }
    }, 5000);

    await channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (!msg) return;
        lastMessageTime = Date.now();

        const systemId = parseInt(msg.content.toString());

        if (isNaN(systemId)) {
          logger.error('❌ Invalid solar system ID:', msg.content.toString());
          errors++;
          channel.ack(msg);
          return;
        }

        try {
          await processSolarSystem(channel, systemId);
          processed++;
          channel.ack(msg);
        } catch (error: any) {
          errors++;
          if (error.response?.status === 404) {
            // A dead ID. Ack it: requeueing would loop forever and there is no
            // row to write without a name.
            logger.warn(`⚠️  Solar system ${systemId} not found (404)`);
            channel.ack(msg);
          } else if (error.response?.status === 420) {
            logger.warn('🛑 Error limited (420)! Waiting 60 seconds...');
            await sleep(60000);
            channel.nack(msg, false, true); // requeue
          } else {
            // The root scan is re-runnable and its message is a bare integer
            // with no attempts counter, so requeue rather than dead-letter.
            logger.error(`❌ Error processing solar system ${systemId}:`, error.message);
            channel.nack(msg, false, true);
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
    logger.error('❌ Failed to start solar system worker:', error);
    process.exit(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

startWorker();
