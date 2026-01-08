import axios from 'axios';
import '../config';
import logger from '../services/logger';
import prismaWorker from '../services/prisma-worker';
import { getRabbitMQChannel } from '../services/rabbitmq';

const ESI_BASE_URL = 'https://esi.evetech.net/latest';
const QUEUE_NAME = 'esi_regions_queue';
const RATE_LIMIT_DELAY = 100; // Wait 100ms between each request (10 requests per second)

/**
 * Checks if the region exists in the database
 */
async function regionExists(regionId: number): Promise<boolean> {
    const region = await prismaWorker.region.findUnique({
        where: { id: regionId },
        select: { id: true }, // Only select id for performance
    });
    return !!region;
}

/**
 * Fetches region information from ESI and saves it to the database
 * Returns true if processed, false if skipped
 */
async function processRegion(regionId: number): Promise<boolean> {
    try {
        // Fetch region information from ESI
        const response = await axios.get(`${ESI_BASE_URL}/universe/regions/${regionId}/`);
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
        await prismaWorker.region.upsert({
            where: { id: regionId },
            update: {
                name: data.name,
                description: data.description || null,
            },
            create: {
                id: regionId,
                name: data.name,
                description: data.description || null,
            },
        });

        logger.debug(`✅ Saved region ${regionId} - ${data.name}`);

        // Short wait for rate limiting - sadece başarılı ESI çağrılarında bekle
        await sleep(RATE_LIMIT_DELAY);
        return true;
    } catch (error: any) {
        if (error.response?.status === 404) {
            logger.warn(`⚠️  Region ${regionId} not found (404)`);
        } else if (error.response?.status === 420) {
            logger.warn(`🛑 Error limited (420)! Waiting 60 seconds...`);
            await sleep(60000);
            throw error; // Requeue the message
        } else {
            logger.error(`❌ Error processing region ${regionId}:`, error.message);
        }
        throw error;
    }
}

/**
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

        logger.info('🚀 Region Worker Started');
        logger.info('==========================');
        logger.info(`📡 Listening to queue: ${QUEUE_NAME}`);
        logger.info(`⏱️  Rate limit: ${1000 / RATE_LIMIT_DELAY} requests/second\n`);

        // Ensure queue exists
        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
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

                const regionId = parseInt(msg.content.toString());

                if (isNaN(regionId)) {
                    logger.error('❌ Invalid region ID:', msg.content.toString());
                    channel.ack(msg);
                    errorCount++;
                    return;
                }

                try {
                    // Check if region already exists in database
                    const exists = await regionExists(regionId);

                    if (exists) {
                        // Skip if already exists - no ESI call needed
                        skippedCount++;
                        logger.debug(
                            `⏭️  Region ${regionId} already exists, skipping... (Processed: ${processedCount}, Skipped: ${skippedCount})`
                        );
                        channel.ack(msg);

                        // Check if queue is empty
                        const currentQueue = await channel.checkQueue(QUEUE_NAME);
                        if (currentQueue.messageCount === 0) {
                            printCompletionSummary(processedCount, skippedCount, errorCount, startTime);
                        }
                        return;
                    }

                    // New region - fetch from ESI and save
                    await processRegion(regionId);
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
