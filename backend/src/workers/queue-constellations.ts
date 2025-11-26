import axios from 'axios';
import '../config';
import { getRabbitMQChannel } from '../services/rabbitmq';

const ESI_BASE_URL = 'https://esi.evetech.net/latest';
const QUEUE_NAME = 'esi_all_constellations_queue';
const BATCH_SIZE = 100;

/**
 * Fetches all constellation IDs from ESI and adds them to RabbitMQ queue
 */
async function queueConstellations() {
    console.log('📡 Fetching all constellation IDs from ESI...\n');

    try {
        // Get all constellation IDs from ESI
        const response = await axios.get(`${ESI_BASE_URL}/universe/constellations/`);
        const constellationIds: number[] = response.data;

        console.log(`✓ Found ${constellationIds.length} constellations`);
        console.log(`📤 Adding to queue...\n`);

        const channel = await getRabbitMQChannel();

        // Ensure queue exists
        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
        });

        // Add to queue in batches
        for (let i = 0; i < constellationIds.length; i += BATCH_SIZE) {
            const batch = constellationIds.slice(i, i + BATCH_SIZE);

            for (const id of batch) {
                channel.sendToQueue(QUEUE_NAME, Buffer.from(id.toString()), {
                    persistent: true,
                });
            }

            console.log(
                `  ⏳ Queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
                    constellationIds.length / BATCH_SIZE
                )} (${batch.length} constellations)`
            );
        }

        console.log(`\n✅ All ${constellationIds.length} constellations queued successfully!`);
        console.log('💡 Now run the worker to process them: yarn worker:constellations\n');

        await channel.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to queue constellations:', error);
        process.exit(1);
    }
}

queueConstellations();
