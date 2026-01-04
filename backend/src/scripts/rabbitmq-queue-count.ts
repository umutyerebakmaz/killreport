/**
 * RabbitMQ Queue Count Script
 *
 * Returns the message count for a specific queue.
 * Used by daily orchestrator to monitor queue progress.
 *
 * Usage: yarn rabbitmq:queue-count <queue-name>
 * Example: yarn rabbitmq:queue-count esi_alliance_info_queue
 */

import { getRabbitMQChannel } from '../services/rabbitmq';

async function getQueueCount(queueName: string): Promise<void> {
  try {
    const channel = await getRabbitMQChannel();

    // Check queue and get stats
    const queueInfo = await channel.checkQueue(queueName);

    // Output only the message count (for easy parsing)
    console.log(queueInfo.messageCount);

    process.exit(0);
  } catch (error: any) {
    console.error(`Error checking queue ${queueName}:`, error.message);
    process.exit(1);
  }
}

// Get queue name from command line arguments
const queueName = process.argv[2];

if (!queueName) {
  console.error('Usage: yarn rabbitmq:queue-count <queue-name>');
  console.error('Example: yarn rabbitmq:queue-count esi_alliance_info_queue');
  process.exit(1);
}

getQueueCount(queueName);
