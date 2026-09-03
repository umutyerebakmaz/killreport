/**
 * Station Worker
 *
 * Sole writer of the stations table.
 *
 * owner_corporation_id, race_id and type_id point at tables other pipelines
 * fill, so they deliberately carry no foreign key - one would lock this ingest to
 * the corporation, race and type pipelines. yarn doctor:topology reports orphaned
 * references instead.
 *
 * Usage: yarn worker:stations
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
  type StationMessage,
} from '../queues/topology-messages';

const QUEUE_NAME = 'esi_stations_queue';
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

async function stationsWorker() {
  logger.info('🚀 Station Worker Started');
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
          const payload = parseTopologyMessage<StationMessage>(msg);

          if (!payload || typeof payload.stationId !== 'number') {
            logger.error('❌ Invalid station message:', msg.content.toString());
            errors++;
            channel.ack(msg);
            return;
          }

          const { stationId, solarSystemId } = payload;

          try {
            const data = await UniverseService.getStation(stationId);

            const row = {
              solar_system_id: solarSystemId,
              name: data.name ?? null,
              type_id: data.type_id ?? null,
              owner_corporation_id: data.owner ?? null,
              race_id: data.race_id ?? null,
              services: data.services ?? [],
              reprocessing_efficiency: data.reprocessing_efficiency ?? null,
              reprocessing_stations_take:
                data.reprocessing_stations_take ?? null,
              office_rental_cost: data.office_rental_cost ?? null,
              max_dockable_ship_volume: data.max_dockable_ship_volume ?? null,
              position_x: data.position?.x ?? null,
              position_y: data.position?.y ?? null,
              position_z: data.position?.z ?? null,
            };

            await prismaWorker.station.upsert({
              where: { id: stationId },
              update: row,
              create: { id: stationId, ...row },
            });

            processed++;
            logger.info(
              `  ✅ [${processed}] Station ${stationId} - ${data.name ?? '(unnamed)'}`,
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
              // A dead ID at ESI. The topology fact - this system has this station
              // - is still authoritative, so write the row without a name.
              // services has no default and is String[], so it must be given here.
              logger.warn(
                `⚠️  Station ${stationId} not found (404), writing row without a name`,
              );
              try {
                await prismaWorker.station.upsert({
                  where: { id: stationId },
                  update: { solar_system_id: solarSystemId },
                  create: {
                    id: stationId,
                    solar_system_id: solarSystemId,
                    services: [],
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
    logger.error('❌ Failed to start station worker:', error);
    process.exit(1);
  }
}

stationsWorker();
