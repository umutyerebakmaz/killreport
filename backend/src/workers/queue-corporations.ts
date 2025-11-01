import axios from 'axios';
import '../config';
import { getRabbitMQChannel } from '../services/rabbitmq';

const ESI_BASE_URL = 'https://esi.evetech.net/latest';
const QUEUE_NAME = 'corporation_sync_queue';
const BATCH_SIZE = 100;

/**
 * Fetches NPC corporation IDs from ESI and adds them to RabbitMQ queue
 * Note: ESI doesn't provide a list of all player corporations, only NPCs
 * Player corporations will be discovered through killmails
 */
async function queueCorporations() {
    console.log('📡 Fetching NPC corporation IDs from ESI...\n');

    try {
        // Get NPC corporation IDs from ESI
        const response = await axios.get(`${ESI_BASE_URL}/corporations/npccorps/`);
        const corporationIds: number[] = response.data;

        console.log(`✓ Found ${corporationIds.length} NPC corporations`);
        console.log(`📤 Adding to queue...\n`);

        const channel = await getRabbitMQChannel();

        // Add to queue in batches
        for (let i = 0; i < corporationIds.length; i += BATCH_SIZE) {
            const batch = corporationIds.slice(i, i + BATCH_SIZE);

            for (const id of batch) {
                channel.sendToQueue(QUEUE_NAME, Buffer.from(id.toString()), {
                    persistent: true,
                });
            }

            console.log(
                `  ✓ Queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
                    corporationIds.length / BATCH_SIZE
                )} (${batch.length} corporations)`
            );
        }

        console.log(
            `\n✅ All ${corporationIds.length} NPC corporations queued successfully!`
        );
        console.log(
            '💡 Now run the worker to process them: npm run worker:corporations\n'
        );
        console.log(
            '📝 Note: Player corporations will be discovered through killmails\n'
        );

        await channel.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to queue corporations:', error);
        process.exit(1);
    }
}

queueCorporations();
