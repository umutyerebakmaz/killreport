import { ItemGroupService } from '../services/item-group';
import logger from '../services/logger';
import prismaWorker from '../services/prisma-worker';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_item_group_info_queue';
const PREFETCH_COUNT = 10; // 10 concurrent ESI requests

let isShuttingDown = false;
let emptyCheckInterval: NodeJS.Timeout | null = null;

/**
 * Worker that fetches item group info from ESI and saves to database
 * Processes messages from esi_item_group_info_queue
 */
async function itemGroupInfoWorker() {
    logger.info('🚀 Starting Item Group Info Worker...');
    logger.info(`📥 Queue: ${QUEUE_NAME}`);
    logger.info(`⚡ Prefetch: ${PREFETCH_COUNT}\n`);

    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalErrors = 0;

    while (!isShuttingDown) {
        try {
            const channel = await getRabbitMQChannel();

            // Ensure queue exists
            await channel.assertQueue(QUEUE_NAME, {
                durable: true,
                arguments: { 'x-max-priority': 10 },
            });

            // Control concurrent processing
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

            logger.info('✅ Worker ready. Waiting for messages...\n');

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
                    logger.info(`📊 Final: ${totalProcessed} processed (${totalCreated} created, ${totalUpdated} updated, ${totalErrors} errors)`);
                    logger.info('━'.repeat(60) + '\n');
                    logger.info('⏳ Waiting for new messages...\n');
                }
            }, 5000);

            // Process messages
            channel.consume(
                QUEUE_NAME,
                async (msg) => {
                    if (msg) lastMessageTime = Date.now();
                    if (!msg) return;

                    try {
                        const message = JSON.parse(msg.content.toString());
                        const itemGroupId = message.entityId;

                        // Check if already exists
                        const existing = await prismaWorker.itemGroup.findUnique({
                            where: { id: itemGroupId },
                        });

                        // Fetch from ESI (her zaman güncel bilgiyi al)
                        const itemGroupInfo = await ItemGroupService.getItemGroupInfo(itemGroupId);

                        // Save to database (upsert to prevent race condition)
                        await prismaWorker.itemGroup.upsert({
                            where: { id: itemGroupId },
                            create: {
                                id: itemGroupId,
                                name: itemGroupInfo.name,
                                category_id: itemGroupInfo.category_id,
                                published: itemGroupInfo.published ?? true,
                            },
                            update: {
                                // Güncellenebilir alanlar
                                name: itemGroupInfo.name,
                                category_id: itemGroupInfo.category_id,
                                published: itemGroupInfo.published ?? true,
                            },
                        });

                        if (existing) {
                            totalUpdated++;
                            logger.info(
                                `  ✅ [${totalProcessed + 1}] ${itemGroupInfo.name} ID:${itemGroupId} (updated)`
                            );
                        } else {
                            totalCreated++;
                            logger.info(
                                `  ✅ [${totalProcessed + 1}] ${itemGroupInfo.name} ID:${itemGroupId} (created)`
                            );
                        }

                        channel.ack(msg);
                        totalProcessed++;

                        // Progress her 100 mesajda bir
                        if (totalProcessed % 100 === 0) {
                            logger.info(`\n📊 Progress: ${totalProcessed} processed (${totalCreated} created, ${totalUpdated} updated, ${totalErrors} errors)\n`);
                        }
                    } catch (error: any) {
                        totalErrors++;
                        logger.error(`  ❌ Error processing message:`, error.message);

                        // ESI 404 hatası alınırsa (item group bulunamadı), mesajı sil
                        if (error.response?.status === 404) {
                            logger.warn('  ⚠️  Item group not found in ESI, removing from queue');
                            channel.ack(msg);
                        } else {
                            // Diğer hatalar için requeue et
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
itemGroupInfoWorker();
