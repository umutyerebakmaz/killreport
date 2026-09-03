import '../src/config';
import { getRabbitMQChannel } from '../src/services/rabbitmq';

const QUEUE_NAME = 'esi_user_killmails_queue';

async function checkQueue() {
  console.log('🔍 Checking RabbitMQ queue status...\n');

  try {
    const channel = await getRabbitMQChannel();

    // Assert queue exists
    const queue = await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: {
        'x-max-priority': 10,
      },
    });

    console.log(`📦 Queue: ${QUEUE_NAME}`);
    console.log(`📊 Messages in queue: ${queue.messageCount}`);
    console.log(`👥 Consumers: ${queue.consumerCount}\n`);

    if (queue.messageCount === 0) {
      console.log('⚠️  Queue is empty. No users queued for killmail sync.');
      console.log('💡 Login via SSO to queue a user automatically.\n');
    }

    await channel.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to check queue:', error);
    process.exit(1);
  }
}

checkQueue();
