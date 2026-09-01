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
// ESI throughput is capped at 50/sec by esiRateLimiter, so this is concurrency,
// not a rate limit. Matches worker-info-corporations.
const PREFETCH_COUNT = 25;

let emptyCheckInterval: NodeJS.Timeout | null = null;

async function stationsWorker() {
  logger.info('🚀 Station Worker Started');
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
            reprocessing_stations_take: data.reprocessing_stations_take ?? null,
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
          logger.debug(`✅ Station ${stationId} - ${data.name ?? '(unnamed)'}`);
          channel.ack(msg);
        } catch (error: any) {
          errors++;
          if (error.response?.status === 404) {
            // A dead ID at ESI. The topology fact - this system has this station
            // - is still authoritative, so write the row without a name.
            // services has no default and is String[], so it must be given here.
            logger.warn(
              `⚠️  Station ${stationId} not found (404), writing row without a name`
            );
            try {
              await prismaWorker.station.upsert({
                where: { id: stationId },
                update: { solar_system_id: solarSystemId },
                create: { id: stationId, solar_system_id: solarSystemId, services: [] },
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
    logger.error('❌ Failed to start station worker:', error);
    process.exit(1);
  }
}

stationsWorker();
