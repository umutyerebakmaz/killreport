import axios from 'axios';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getRabbitMQChannel } from '@services/rabbitmq';

const ESI_BASE_URL = 'https://esi.evetech.net/latest';
const QUEUE_NAME = 'esi_solar_systems_queue';
const RATE_LIMIT_DELAY = 100; // Wait 100ms between each request (10 requests per second)

interface EsiPlanet {
  planet_id: number;
  moons?: number[];
  asteroid_belts?: number[];
}

/**
 * Fetches solar system information from ESI and saves it — along with the full
 * celestial topology contained in the same response — to the database.
 *
 * This is a root scanner: it never skips a message. The "already in the
 * database?" filter belongs to the enrichment queues one layer down, exactly as
 * queue-alliances (unfiltered) and queue-alliance-corporation-characters
 * (filtered) are split today.
 */
async function processSolarSystem(systemId: number): Promise<boolean> {
  try {
    // Fetch solar system information from ESI
    const response = await axios.get(`${ESI_BASE_URL}/universe/systems/${systemId}/`);
    const data = response.data;

    // Check rate limit headers
    const errorLimitRemain = response.headers['x-esi-error-limit-remain'];
    if (errorLimitRemain && parseInt(errorLimitRemain) < 20) {
      logger.warn(
        `⚠️  Error limit low (${errorLimitRemain}/100), slowing down...`
      );
      await sleep(2000); // Wait 2 seconds
    }

    // Every one of these keys can be absent from the response, not merely empty:
    // 4-HWWF has no `stations`, Thera has no `stargates` and no
    // `security_class`, and Jita has planets with no `asteroid_belts`.
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

    await prismaWorker.$transaction(
      async (tx) => {
        await tx.solarSystem.upsert({
          where: { id: systemId },
          update: systemRow,
          create: { id: systemId, ...systemRow },
        });

        // NOTE: none of the child upserts touch `name`. This worker only writes
        // topology; names arrive from the enrichment workers and must survive a
        // re-run of this scan.
        if (starId !== null) {
          await tx.star.upsert({
            where: { id: starId },
            update: { solar_system_id: systemId },
            create: { id: starId, solar_system_id: systemId },
          });
        }

        for (const stargateId of stargateIds) {
          await tx.stargate.upsert({
            where: { id: stargateId },
            update: { solar_system_id: systemId },
            create: { id: stargateId, solar_system_id: systemId },
          });
        }

        for (const stationId of stationIds) {
          await tx.station.upsert({
            where: { id: stationId },
            update: { solar_system_id: systemId },
            create: { id: stationId, solar_system_id: systemId, services: [] },
          });
        }

        // The planet -> moon / asteroid belt link exists ONLY here. Neither
        // /universe/moons/{id}/ nor /universe/asteroid_belts/{id}/ returns
        // planet_id, so if this loop does not record it, it is unrecoverable.
        for (let p = 0; p < planets.length; p++) {
          const planet = planets[p];
          await tx.planet.upsert({
            where: { id: planet.planet_id },
            update: { solar_system_id: systemId, orbit_index: p + 1 },
            create: { id: planet.planet_id, solar_system_id: systemId, orbit_index: p + 1 },
          });

          const moonIds = planet.moons ?? [];
          for (let m = 0; m < moonIds.length; m++) {
            await tx.moon.upsert({
              where: { id: moonIds[m] },
              update: {
                solar_system_id: systemId,
                planet_id: planet.planet_id,
                orbit_index: m + 1,
              },
              create: {
                id: moonIds[m],
                solar_system_id: systemId,
                planet_id: planet.planet_id,
                orbit_index: m + 1,
              },
            });
          }

          const beltIds = planet.asteroid_belts ?? [];
          for (let b = 0; b < beltIds.length; b++) {
            await tx.asteroidBelt.upsert({
              where: { id: beltIds[b] },
              update: {
                solar_system_id: systemId,
                planet_id: planet.planet_id,
                orbit_index: b + 1,
              },
              create: {
                id: beltIds[b],
                solar_system_id: systemId,
                planet_id: planet.planet_id,
                orbit_index: b + 1,
              },
            });
          }
        }
      },
      // A system with 73 moons is roughly 90 upserts; Prisma's 5s default is not
      // enough.
      { timeout: 30000 }
    );

    const moonCount = planets.reduce((n, p) => n + (p.moons?.length ?? 0), 0);
    const beltCount = planets.reduce((n, p) => n + (p.asteroid_belts?.length ?? 0), 0);
    logger.debug(
      `✅ Saved solar system ${systemId} - ${data.name} ` +
        `(${stargateIds.length} gates, ${stationIds.length} stations, ` +
        `${planets.length} planets, ${moonCount} moons, ${beltCount} belts)`
    );

    // Short wait for rate limiting
    await sleep(RATE_LIMIT_DELAY);
    return true;
  } catch (error: any) {
    if (error.response?.status === 404) {
      logger.warn(`⚠️  Solar system ${systemId} not found (404)`);
    } else if (error.response?.status === 420) {
      logger.warn(`🛑 Error limited (420)! Waiting 60 seconds...`);
      await sleep(60000);
      throw error; // Requeue the message
    } else {
      logger.error(`❌ Error processing solar system ${systemId}:`, error.message);
    }
    throw error;
  }
}

/**
 * Prints completion summary when queue is empty
 */
function printCompletionSummary(
  processedCount: number,
  errorCount: number,
  startTime: number
) {
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logger.info('\n' + '='.repeat(60));
  logger.info('🎉 ALL TASKS COMPLETED!');
  logger.info('='.repeat(60));
  logger.info(`✅ Processed: ${processedCount}`);
  logger.info(`❌ Errors: ${errorCount}`);
  logger.info(`📊 Total: ${processedCount + errorCount}`);
  logger.info(`⏱️  Duration: ${duration}s`);
  logger.info('='.repeat(60));
  logger.info('\n💡 Queue is empty, waiting for new messages...');
  logger.info('   Press CTRL+C to stop.\n');
}

/**
 * Worker - Receives and processes messages from RabbitMQ
 */
async function startWorker() {
  try {
    const channel = await getRabbitMQChannel();

    let processedCount = 0;
    let errorCount = 0;
    let startTime = Date.now();

    logger.info('🚀 Solar System Worker Started');
    logger.info('==========================');
    logger.info(`📡 Listening to queue: ${QUEUE_NAME}`);
    logger.info(`⏱️  Rate limit: ${1000 / RATE_LIMIT_DELAY} requests/second\n`);

    // Ensure queue exists
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      // Every other queue in the repo is declared with this, and server.ts's
      // ensureAllQueuesExist() creates them all that way. Omitting it makes
      // assertQueue fail with 406 PRECONDITION_FAILED.
      arguments: { 'x-max-priority': 10 },
    });

    // Check initial queue status
    const queueInfo = await channel.checkQueue(QUEUE_NAME);
    logger.info(`📊 Queue status: ${queueInfo.messageCount} messages waiting\n`);

    // Process only 1 message at a time
    channel.prefetch(1);

    channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (!msg) return;

        const systemId = parseInt(msg.content.toString());

        if (isNaN(systemId)) {
          logger.error('❌ Invalid solar system ID:', msg.content.toString());
          channel.ack(msg);
          errorCount++;
          return;
        }

        try {
          await processSolarSystem(systemId);
          processedCount++;
          channel.ack(msg);

          // Check if queue is empty
          const currentQueue = await channel.checkQueue(QUEUE_NAME);
          if (currentQueue.messageCount === 0) {
            printCompletionSummary(processedCount, errorCount, startTime);
          }
        } catch (error) {
          errorCount++;
          channel.nack(msg, false, false);
        }
      },
      { noAck: false }
    );

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.warn('\n\n🛑 Shutting down worker...');
      await channel.close();
      await prismaWorker.$disconnect();
      logger.info('✅ Worker stopped gracefully');
      process.exit(0);
    });
  } catch (error) {
    logger.error('❌ Failed to start worker:', error);
    process.exit(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

startWorker();
