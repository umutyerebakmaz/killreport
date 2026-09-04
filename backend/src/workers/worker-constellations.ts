import axios from 'axios';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getRabbitMQChannel } from '@services/rabbitmq';

const ESI_BASE_URL = 'https://esi.evetech.net/latest';
const QUEUE_NAME = 'esi_constellations_queue';
const RATE_LIMIT_DELAY = 100; // Wait 100ms between each request (10 requests per second)

/**
 * Checks if the constellation exists in the database
 */
async function constellationExists(constellationId: number): Promise<boolean> {
  const constellation = await prismaWorker.constellation.findUnique({
    where: { id: constellationId },
    select: { id: true }, // Only select id for performance
  });
  return !!constellation;
}

/**
 * Fetches constellation information from ESI and saves it to the database
 * Returns true if processed, false if skipped
 */
async function processConstellation(constellationId: number): Promise<boolean> {
  try {
    // Fetch constellation information from ESI
    const response = await axios.get(`${ESI_BASE_URL}/universe/constellations/${constellationId}/`);
    const data = response.data;

    // Check rate limit headers
    const errorLimitRemain = response.headers['x-esi-error-limit-remain'];
    if (errorLimitRemain && parseInt(errorLimitRemain) < 20) {
      logger.warn(
        `⚠️  Error limit low (${errorLimitRemain}/100), slowing down...`
      );
      await sleep(2000); // Wait 2 seconds
    }

    // Save to database using Prisma
    await prismaWorker.constellation.upsert({
      where: { id: constellationId },
      update: {
        name: data.name,
        region_id: data.region_id || null,
        position_x: data.position?.x || null,
        position_y: data.position?.y || null,
        position_z: data.position?.z || null,
      },
      create: {
        id: constellationId,
        name: data.name,
        region_id: data.region_id || null,
        position_x: data.position?.x || null,
        position_y: data.position?.y || null,
        position_z: data.position?.z || null,
      },
    });

    logger.debug(`✅ Saved constellation ${constellationId} - ${data.name}`);

    // Short wait for rate limiting - sadece başarılı ESI çağrılarında bekle
    await sleep(RATE_LIMIT_DELAY);
    return true;
  } catch (error: any) {
    if (error.response?.status === 404) {
      logger.warn(`⚠️  Constellation ${constellationId} not found (404)`);
    } else if (error.response?.status === 420) {
      logger.warn(`🛑 Error limited (420)! Waiting 60 seconds...`);
      await sleep(60000);
      throw error; // Requeue the message
    } else {
      logger.error(`❌ Error processing constellation ${constellationId}:`, error.message);
    }
    throw error;
  }
}/**
 * Prints completion summary when queue is empty
 */
function printCompletionSummary(
  processedCount: number,
  skippedCount: number,
  errorCount: number,
  startTime: number
) {
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logger.info('\n' + '='.repeat(60));
  logger.info('🎉 ALL TASKS COMPLETED!');
  logger.info('='.repeat(60));
  logger.info(`✅ Processed: ${processedCount}`);
  logger.info(`⏭️  Skipped (already exists): ${skippedCount}`);
  logger.info(`❌ Errors: ${errorCount}`);
  logger.info(`📊 Total: ${processedCount + skippedCount + errorCount}`);
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
    let skippedCount = 0;
    let errorCount = 0;
    let startTime = Date.now();

    logger.info('🚀 Constellation Worker Started');
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

        const constellationId = parseInt(msg.content.toString());

        if (isNaN(constellationId)) {
          logger.error('❌ Invalid constellation ID:', msg.content.toString());
          channel.ack(msg);
          errorCount++;
          return;
        }

        try {
          // Check if constellation already exists in database
          const exists = await constellationExists(constellationId);

          if (exists) {
            // Skip if already exists - no ESI call needed
            skippedCount++;
            logger.debug(
              `⏭️  Constellation ${constellationId} already exists, skipping... (Processed: ${processedCount}, Skipped: ${skippedCount})`
            );
            channel.ack(msg);

            // Check if queue is empty
            const currentQueue = await channel.checkQueue(QUEUE_NAME);
            if (currentQueue.messageCount === 0) {
              printCompletionSummary(processedCount, skippedCount, errorCount, startTime);
            }
            return;
          }

          // New constellation - fetch from ESI and save
          await processConstellation(constellationId);
          processedCount++;
          channel.ack(msg);

          // Check if queue is empty
          const currentQueue = await channel.checkQueue(QUEUE_NAME);
          if (currentQueue.messageCount === 0) {
            printCompletionSummary(processedCount, skippedCount, errorCount, startTime);
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
