import axios from 'axios';
import '../config';
import { getRabbitMQChannel } from '../services/rabbitmq';

const ESI_BASE_URL = 'https://esi.evetech.net/latest';
const QUEUE_NAME = 'esi_all_regions_queue';
const BATCH_SIZE = 100;

/**
 * Fetches all region IDs from ESI and adds them to RabbitMQ queue
 */
async function queueRegions() {
  console.log('📡 Fetching all region IDs from ESI...\n');

  try {
    // Get all region IDs from ESI
    const response = await axios.get(`${ESI_BASE_URL}/universe/regions/`);
    const regionIds: number[] = response.data;

    console.log(`✓ Found ${regionIds.length} regions`);
    console.log(`📤 Adding to queue...\n`);

    const channel = await getRabbitMQChannel();

    // Ensure queue exists
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
    });

    // Add to queue in batches
    for (let i = 0; i < regionIds.length; i += BATCH_SIZE) {
      const batch = regionIds.slice(i, i + BATCH_SIZE);

      for (const id of batch) {
        channel.sendToQueue(QUEUE_NAME, Buffer.from(id.toString()), {
          persistent: true,
        });
      }

      console.log(
        `  ⏳ Queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
          regionIds.length / BATCH_SIZE
        )} (${batch.length} regions)`
      );
    }

    console.log(`\n✅ All ${regionIds.length} regions queued successfully!`);
    console.log('💡 Now run the worker to process them: yarn worker:regions\n');

    await channel.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to queue regions:', error);
    process.exit(1);
  }
}

queueRegions();
