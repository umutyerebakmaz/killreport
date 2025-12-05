import { ItemGroupService } from '../services/item-group';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_item_group_info_queue';
const PREFETCH_COUNT = 10; // 10 concurrent ESI requests

/**
 * Worker that fetches item group info from ESI and saves to database
 * Processes messages from esi_item_group_info_queue
 */
async function itemGroupInfoWorker() {
    console.log('🚀 Starting Item Group Info Worker...');
    console.log(`📥 Queue: ${QUEUE_NAME}`);
    console.log(`⚡ Prefetch: ${PREFETCH_COUNT}\n`);

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

        console.log('✅ Worker ready. Waiting for messages...\n');

        // Process messages
        channel.consume(
            QUEUE_NAME,
            async (msg) => {
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
                        console.log(
                            `  ✅ [${totalProcessed + 1}] ${itemGroupInfo.name} ID:${itemGroupId} (updated)`
                        );
                    } else {
                        totalCreated++;
                        console.log(
                            `  ✅ [${totalProcessed + 1}] ${itemGroupInfo.name} ID:${itemGroupId} (created)`
                        );
                    }

                    channel.ack(msg);
                    totalProcessed++;

                    // Progress her 100 mesajda bir
                    if (totalProcessed % 100 === 0) {
                        console.log(`\n📊 Progress: ${totalProcessed} processed (${totalCreated} created, ${totalUpdated} updated, ${totalErrors} errors)\n`);
                    }
                } catch (error: any) {
                    totalErrors++;
                    console.error(`  ❌ Error processing message:`, error.message);

                    // ESI 404 hatası alınırsa (item group bulunamadı), mesajı sil
                    if (error.response?.status === 404) {
                        console.log('  ⚠️  Item group not found in ESI, removing from queue');
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
            console.log('\n\n⏹️  Shutting down worker...');
            console.log(`\n📊 Final Stats:`);
            console.log(`   Total Processed: ${totalProcessed}`);
            console.log(`   Created: ${totalCreated}`);
            console.log(`   Updated: ${totalUpdated}`);
            console.log(`   Errors: ${totalErrors}`);
            await channel.close();
            process.exit(0);
        });
    } catch (error) {
        console.error('❌ Worker error:', error);
        process.exit(1);
    }
}

itemGroupInfoWorker();
