import '../config';
import { CategoryService } from '../services/category';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_category_info_queue';
const BATCH_SIZE = 50;

/**
 * Fetches all category IDs from ESI and adds them to RabbitMQ queue
 * These will be processed by worker:info:categories
 */
async function queueCategories() {
    console.log('📡 Fetching all category IDs from ESI...\n');

    try {
        // Get all category IDs from ESI
        const categoryIds = await CategoryService.getAllCategoryIds();

        console.log(`✓ Found ${categoryIds.length} categories`);
        console.log(`📤 Adding to queue: ${QUEUE_NAME}\n`);

        const channel = await getRabbitMQChannel();

        // Ensure queue exists
        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
            arguments: { 'x-max-priority': 10 },
        });

        // Add to queue in batches with proper message format
        for (let i = 0; i < categoryIds.length; i += BATCH_SIZE) {
            const batch = categoryIds.slice(i, i + BATCH_SIZE);

            for (const id of batch) {
                const message = {
                    entityId: id,
                    queuedAt: new Date().toISOString(),
                    source: 'queue-categories',
                };
                channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
                    persistent: true,
                });
            }

            console.log(
                `  ⏳ Queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
                    categoryIds.length / BATCH_SIZE
                )} (${batch.length} categories)`
            );
        }

        console.log(`\n✅ All ${categoryIds.length} categories queued successfully!`);
        console.log('💡 Now run the worker: yarn worker:info:categories\n');

        await channel.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to queue categories:', error);
        process.exit(1);
    }
}

queueCategories();
