import axios from 'axios';
import '../config';
import { getRabbitMQChannel } from '../services/rabbitmq';

const ESI_BASE_URL = 'https://esi.evetech.net/latest';
const QUEUE_NAME = 'esi_all_alliances_queue';
const BATCH_SIZE = 100;

/**
 * Fetches all alliance IDs from ESI and adds them to RabbitMQ queue
 */
async function queueAlliances() {
  console.log('📡 Fetching all alliance IDs from ESI...\n');

  try {
    // Get all alliance IDs from ESI
    const response = await axios.get(`${ESI_BASE_URL}/alliances/`);
    const allianceIds: number[] = response.data;

    console.log(`✓ Found ${allianceIds.length} alliances`);
    console.log(`📤 Adding to queue...\n`);

    const channel = await getRabbitMQChannel();

    // Add to queue in batches
    for (let i = 0; i < allianceIds.length; i += BATCH_SIZE) {
      const batch = allianceIds.slice(i, i + BATCH_SIZE);

      for (const id of batch) {
        channel.sendToQueue(QUEUE_NAME, Buffer.from(id.toString()), {
          persistent: true,
        });
      }

      console.log(
        `  ✓ Queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
          allianceIds.length / BATCH_SIZE
        )} (${batch.length} alliances)`
      );
    }

    console.log(`\n✅ All ${allianceIds.length} alliances queued successfully!`);
    console.log('💡 Now run the worker to process them: yarn worker:alliances\n');

    await channel.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to queue alliances:', error);
    process.exit(1);
  }
}

queueAlliances();
