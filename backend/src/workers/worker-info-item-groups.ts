import { ItemGroupService } from '../services/item-group';
import logger from '../services/logger';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_item_group_info_queue';
const PREFETCH_COUNT = 10; // 10 concurrent ESI requests

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

    try {
        const channel = await getRabbitMQChannel();

        // Ensure queue exists
        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
            arguments: { 'x-max-priority': 10 },
        });

        // Control concurrent processing
        channel.prefetch(PREFETCH_COUNT);

        logger.info('✅ Worker ready. Waiting for messages...\n');

        let lastMessageTime = Date.now();

        // Check if queue is empty every 5 seconds
        const emptyCheckInterval = setInterval(async () => {
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
                    const existing = await prisma.itemGroup.findUnique({
                        where: { id: itemGroupId },
                    });

                    // Fetch from ESI (her zaman güncel bilgiyi al)
                    const itemGroupInfo = await ItemGroupService.getItemGroupInfo(itemGroupId);

                    // Save to database (upsert to prevent race condition)
                    await prisma.itemGroup.upsert({
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
                        logger.debug(
                            `  ✅ [${totalProcessed + 1}] ${itemGroupInfo.name} ID:${itemGroupId} (updated)`
                        );
                    } else {
                        totalCreated++;
                        logger.debug(
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

        // Graceful shutdown
        process.on('SIGINT', async () => {
            logger.warn('\n\n⏹️  Shutting down worker...');
            logger.info(`\n📊 Final Stats:`);
            logger.info(`   Total Processed: ${totalProcessed}`);
            logger.info(`   Created: ${totalCreated}`);
            logger.info(`   Updated: ${totalUpdated}`);
            logger.info(`   Errors: ${totalErrors}`);
            clearInterval(emptyCheckInterval);
            await channel.close();
            process.exit(0);
        });
    } catch (error) {
        logger.error('❌ Worker error:', error);
        process.exit(1);
    }
}

itemGroupInfoWorker();
