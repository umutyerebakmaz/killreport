import '../config';
import { getRabbitMQChannel } from '../services/rabbitmq';
import { SolarSystemService } from '../services/solar-system';

const QUEUE_NAME = 'esi_all_systems_queue';
const BATCH_SIZE = 100;

/**
 * Fetches all solar system IDs from ESI and adds them to RabbitMQ queue
 */
async function queueSolarSystems() {
  console.log('📡 Fetching all solar system IDs from ESI...\n');

  try {
    // Get all system IDs from ESI
    const systemIds = await SolarSystemService.getAllSystemIds();

    console.log(`✓ Found ${systemIds.length} solar systems`);
    console.log(`📤 Adding to queue...\n`);

    const channel = await getRabbitMQChannel();

    // Ensure queue exists
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
    });

    // Add to queue in batches
    for (let i = 0; i < systemIds.length; i += BATCH_SIZE) {
      const batch = systemIds.slice(i, i + BATCH_SIZE);

      for (const id of batch) {
        channel.sendToQueue(QUEUE_NAME, Buffer.from(id.toString()), {
          persistent: true,
        });
      }

      console.log(
        `  ⏳ Queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
          systemIds.length / BATCH_SIZE
        )} (${batch.length} systems)`
      );
    }

    console.log(`\n✅ All ${systemIds.length} solar systems queued successfully!`);
    console.log('💡 Now run the worker to process them: yarn worker:systems\n');

    await channel.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to queue solar systems:', error);
    process.exit(1);
  }
}

queueSolarSystems();
