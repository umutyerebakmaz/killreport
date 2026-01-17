/**
 * Alliance Corporation Worker
 * Fetches corporation IDs from ESI for each alliance and queues them for info fetch
 *
 * Workflow:
 * 1. Consumes alliance IDs from esi_alliance_corporations_queue
 * 2. Fetches corporation IDs from ESI (/alliances/{alliance_id}/corporations/)
 * 3. Queues each corporation ID to esi_corporation_info_queue
 * 4. worker-info-corporations.ts then processes these IDs
 *
 * Usage: yarn worker:alliance-corporations
 */

import '../config';
import { AllianceService } from '../services/alliance';
import logger from '../services/logger';
import prismaWorker from '../services/prisma-worker';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_alliance_corporations_queue';
const CORPORATION_QUEUE = 'esi_corporation_info_queue';
const PREFETCH_COUNT = 5; // Process 5 alliances concurrently

// Shutdown flag and interval tracking
let isShuttingDown = false;
let emptyCheckInterval: NodeJS.Timeout | null = null;

interface EntityQueueMessage {
    entityId: number;
    queuedAt: string;
    source: string;
}

async function allianceCorporationWorker() {
    while (!isShuttingDown) {
        logger.info('🤝 Alliance Corporation Worker Started');
        logger.info(`📦 Input Queue: ${QUEUE_NAME}`);
        logger.info(`📦 Output Queue: ${CORPORATION_QUEUE}`);
        logger.info(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent\n`);

        try {
            const channel = await getRabbitMQChannel();

            // Assert both queues exist
            await channel.assertQueue(QUEUE_NAME, {
                durable: true,
                arguments: { 'x-max-priority': 10 },
            });

            await channel.assertQueue(CORPORATION_QUEUE, {
                durable: true,
                arguments: { 'x-max-priority': 10 },
            });

            channel.prefetch(PREFETCH_COUNT);

            logger.info('✅ Connected to RabbitMQ');
            logger.info('⏳ Waiting for alliances...\n');

            let totalProcessed = 0;
            let totalCorporationsQueued = 0;
            let totalErrors = 0;
            let lastMessageTime = Date.now();

            // Clear existing interval before creating new one
            if (emptyCheckInterval) {
                clearInterval(emptyCheckInterval);
            }

            // Check if queue is empty every 5 seconds
            emptyCheckInterval = setInterval(async () => {
                const timeSinceLastMessage = Date.now() - lastMessageTime;
                if (timeSinceLastMessage > 5000 && totalProcessed > 0) {
                    logger.info('\n' + '━'.repeat(60));
                    logger.info('✅ Queue completed!');
                    logger.info(
                        `📊 Final: ${totalProcessed} alliances processed, ${totalCorporationsQueued} corporations queued, ${totalErrors} errors`
                    );
                    logger.info('━'.repeat(60) + '\n');
                    logger.info('⏳ Waiting for new messages...\n');
                }
            }, 5000);

            // Add channel error handlers
            channel.on('error', (err) => {
                if (!isShuttingDown) {
                    logger.error('💥 Channel error:', err);
                }
            });

            channel.on('close', () => {
                if (!isShuttingDown) {
                    logger.warn('⚠️  Channel closed unexpectedly');
                }
            });

            await channel.consume(
                QUEUE_NAME,
                async (msg) => {
                    if (msg) lastMessageTime = Date.now();
                    if (!msg) return;

                    const message: EntityQueueMessage = JSON.parse(msg.content.toString());
                    const allianceId = message.entityId;

                    try {
                        // Get alliance name for logging
                        const alliance = await prismaWorker.alliance.findUnique({
                            where: { id: allianceId },
                            select: { name: true, ticker: true },
                        });

                        const allianceName = alliance?.name || `Unknown`;
                        const allianceTicker = alliance?.ticker || '???';

                        // Fetch corporation IDs from ESI
                        const corporationIds = await AllianceService.getAllianceCorporations(allianceId);

                        if (corporationIds.length === 0) {
                            logger.info(
                                `  ⚠️  [${totalProcessed + 1}][${allianceId}] ${allianceName} [${allianceTicker}] - No corporations`
                            );
                            channel.ack(msg);
                            totalProcessed++;
                            return;
                        }

                        // Queue each corporation ID for info fetch
                        let queuedCount = 0;
                        for (const corpId of corporationIds) {
                            const corpMessage: EntityQueueMessage = {
                                entityId: corpId,
                                queuedAt: new Date().toISOString(),
                                source: `alliance_${allianceId}`,
                            };

                            channel.sendToQueue(
                                CORPORATION_QUEUE,
                                Buffer.from(JSON.stringify(corpMessage)),
                                {
                                    persistent: true,
                                    priority: 3, // Lower priority than direct enrichment requests
                                }
                            );

                            queuedCount++;
                        }

                        totalCorporationsQueued += queuedCount;
                        totalProcessed++;

                        logger.debug(
                            `  ✅ [${totalProcessed}][${allianceId}] ${allianceName} [${allianceTicker}] - Queued ${queuedCount} corps`
                        );

                        channel.ack(msg);
                    } catch (error) {
                        totalErrors++;
                        totalProcessed++;

                        logger.error(
                            `  ❌ [${totalProcessed}][${allianceId}] Error: ${error instanceof Error ? error.message : error}`
                        );

                        // Nack and requeue for retry
                        channel.nack(msg, false, true);
                    }
                },
                { noAck: false }
            );

            // Wait indefinitely (until error or shutdown)
            await new Promise(() => { });
        } catch (error) {
            if (isShuttingDown) break;
            logger.error('💥 Worker connection lost, reconnecting in 5s...', error);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    // Cleanup
    logger.info('🧹 Worker cleanup completed');
    if (emptyCheckInterval) {
        clearInterval(emptyCheckInterval);
        emptyCheckInterval = null;
    }
    await prismaWorker.$disconnect();
}

/**
 * Graceful shutdown handlers
 */
function setupShutdownHandlers() {
    const shutdown = async () => {
        isShuttingDown = true;
        if (emptyCheckInterval) {
            clearInterval(emptyCheckInterval);
            emptyCheckInterval = null;
        }
        logger.warn('\n⚠️  Received shutdown signal, shutting down gracefully...');
        await prismaWorker.$disconnect();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

setupShutdownHandlers();
allianceCorporationWorker();
