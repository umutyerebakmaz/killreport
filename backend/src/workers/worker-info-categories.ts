/**
 * Category Info Worker
 * Fetches category information from ESI and saves to database
 */

import '../config';
import { CategoryService } from '../services/category';
import logger from '../services/logger';
import prismaWorker from '../services/prisma-worker';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_category_info_queue';
const PREFETCH_COUNT = 10; // Process 10 categories concurrently

interface EntityQueueMessage {
    entityId: number;
    queuedAt: string;
    source: string;
}

let isShuttingDown = false;
let emptyCheckInterval: NodeJS.Timeout | null = null;

async function categoryInfoWorker() {
    logger.info('📦 Category Info Worker Started');
    logger.info(`📦 Queue: ${QUEUE_NAME}`);
    logger.info(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent\n`);

    while (!isShuttingDown) {
        try {
            const channel = await getRabbitMQChannel();

            await channel.assertQueue(QUEUE_NAME, {
                durable: true,
                arguments: { 'x-max-priority': 10 },
            });

            channel.prefetch(PREFETCH_COUNT);

            // Handle channel errors
            channel.on('error', (err) => {
                logger.error('❌ Channel error:', err.message);
                if (emptyCheckInterval) {
                    clearInterval(emptyCheckInterval);
                    emptyCheckInterval = null;
                }
            });

            channel.on('close', () => {
                logger.warn('⚠️  Channel closed');
                if (emptyCheckInterval) {
                    clearInterval(emptyCheckInterval);
                    emptyCheckInterval = null;
                }
            });

            logger.info('✅ Connected to RabbitMQ');
            logger.info('⏳ Waiting for categories...\n');

            let totalProcessed = 0;
            let totalCreated = 0;
            let totalUpdated = 0;
            let totalErrors = 0;
            let lastMessageTime = Date.now();

            // Clear any existing interval
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
                        `📊 Final: ${totalProcessed} processed (${totalCreated} created, ${totalUpdated} updated, ${totalErrors} errors)`
                    );
                    logger.info('━'.repeat(60) + '\n');
                    logger.info('⏳ Waiting for new messages...\n');
                }
            }, 5000);

            channel.consume(
                QUEUE_NAME,
                async (msg) => {
                    if (msg) lastMessageTime = Date.now();
                    if (!msg) return;

                    const message: EntityQueueMessage = JSON.parse(msg.content.toString());
                    const categoryId = message.entityId;

                    try {
                        // Check if already exists
                        const existing = await prismaWorker.category.findUnique({
                            where: { id: categoryId },
                        });

                        // Fetch from ESI (her zaman güncel bilgiyi al)
                        const categoryInfo = await CategoryService.getCategoryInfo(categoryId);

                        // Save to database (upsert to prevent race condition)
                        await prismaWorker.category.upsert({
                            where: { id: categoryId },
                            create: {
                                id: categoryId,
                                name: categoryInfo.name,
                                published: categoryInfo.published,
                            },
                            update: {
                                // Güncellenebilir alanlar
                                name: categoryInfo.name,
                                published: categoryInfo.published,
                            },
                        });

                        if (existing) {
                            totalUpdated++;
                            logger.info(
                                `  ✅ [${totalProcessed + 1}] ${categoryInfo.name} ID:${categoryId} (updated)`
                            );
                        } else {
                            totalCreated++;
                            logger.info(
                                `  ✅ [${totalProcessed + 1}] ${categoryInfo.name} ID:${categoryId} (created)`
                            );
                        }

                        channel.ack(msg);
                        totalProcessed++;
                    } catch (error: any) {
                        totalErrors++;
                        totalProcessed++;

                        if (error.message?.includes('404')) {
                            logger.warn(`  ! [${totalProcessed}] Category ${message.entityId} (404)`);
                            channel.ack(msg);
                        } else {
                            logger.error(
                                `  × [${totalProcessed}] Category ${message.entityId}: ${error.message}`
                            );
                            channel.nack(msg, false, true);
                        }
                    }
                },
                { noAck: false }
            );

            // Wait indefinitely unless connection fails
            await new Promise((resolve, reject) => {
                channel.on('error', reject);
                channel.on('close', reject);
            });

        } catch (error: any) {
            if (isShuttingDown) {
                logger.info('Worker stopped during shutdown');
                break;
            }

            logger.error('💥 Worker error:', error.message);

            if (emptyCheckInterval) {
                clearInterval(emptyCheckInterval);
                emptyCheckInterval = null;
            }

            // Wait before reconnecting
            logger.info('🔄 Reconnecting in 5 seconds...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    logger.info('Worker stopped');
    await prismaWorker.$disconnect();
}

function setupShutdownHandlers() {
    const shutdown = async () => {
        logger.warn('\n\n⚠️  Shutting down...');
        isShuttingDown = true;

        if (emptyCheckInterval) {
            clearInterval(emptyCheckInterval);
            emptyCheckInterval = null;
        }

        await prismaWorker.$disconnect();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

setupShutdownHandlers();
categoryInfoWorker();
