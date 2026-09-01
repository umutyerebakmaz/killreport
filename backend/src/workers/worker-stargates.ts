/**
 * Stargate Worker
 *
 * Sole writer of the stargates table.
 *
 * destination_system_id now has a foreign key (ON DELETE SET NULL). If this
 * worker runs concurrently with worker-solar-systems, the destination system row
 * may not exist yet and Prisma throws P2003; handleWorkerError treats that as
 * retryable and republishes with an incremented attempts counter. Running the
 * system queue to completion first avoids it entirely.
 *
 * destination_stargate_id deliberately has NO foreign key: the destination gate
 * row is created by this same worker, so it would produce a frequently triggered
 * ordering dependency inside a single queue.
 *
 * Usage: yarn worker:stargates
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getRabbitMQChannel } from '@services/rabbitmq';
import { UniverseService } from '@services/universe/universe.service';
import {
  assertTopologyQueue,
  handleWorkerError,
  parseTopologyMessage,
  type StargateMessage,
} from '../queues/topology-messages';

const QUEUE_NAME = 'esi_stargates_queue';
// ESI throughput is capped at 50/sec by esiRateLimiter, so this is concurrency,
// not a rate limit. Matches worker-info-corporations.
const PREFETCH_COUNT = 25;

let emptyCheckInterval: NodeJS.Timeout | null = null;

async function stargatesWorker() {
  logger.info('🚀 Stargate Worker Started');
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

        const payload = parseTopologyMessage<StargateMessage>(msg);

        if (!payload || typeof payload.stargateId !== 'number') {
          logger.error('❌ Invalid stargate message:', msg.content.toString());
          errors++;
          channel.ack(msg);
          return;
        }

        const { stargateId, solarSystemId } = payload;

        try {
          const data = await UniverseService.getStargate(stargateId);

          const row = {
            solar_system_id: solarSystemId,
            name: data.name ?? null,
            destination_system_id: data.destination?.system_id ?? null,
            destination_stargate_id: data.destination?.stargate_id ?? null,
            type_id: data.type_id ?? null,
            position_x: data.position?.x ?? null,
            position_y: data.position?.y ?? null,
            position_z: data.position?.z ?? null,
          };

          await prismaWorker.stargate.upsert({
            where: { id: stargateId },
            update: row,
            create: { id: stargateId, ...row },
          });

          processed++;
          logger.debug(`✅ Stargate ${stargateId} - ${data.name ?? '(unnamed)'}`);
          channel.ack(msg);
        } catch (error: any) {
          errors++;
          if (error.response?.status === 404) {
            // A dead ID at ESI. The topology fact - this system has this gate -
            // is still authoritative, so write the row without a name or
            // destination.
            logger.warn(
              `⚠️  Stargate ${stargateId} not found (404), writing row without a name`
            );
            try {
              await prismaWorker.stargate.upsert({
                where: { id: stargateId },
                update: { solar_system_id: solarSystemId },
                create: { id: stargateId, solar_system_id: solarSystemId },
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
    logger.error('❌ Failed to start stargate worker:', error);
    process.exit(1);
  }
}

stargatesWorker();
