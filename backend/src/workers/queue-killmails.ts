import '../config';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'killmail_sync_queue';

/**
 * Queue all active users for killmail sync
 * Similar to alliance queue but for user killmail syncing
 */
async function queueKillmailSync() {
  console.log('📡 Queueing users for killmail sync...\n');

  try {
    // Get all users with valid tokens
    const users = await prisma.user.findMany({
      where: {
        expires_at: {
          gt: new Date(), // Token not expired
        },
      },
      select: {
        id: true,
        character_id: true,
        character_name: true,
      },
    });

    if (users.length === 0) {
      console.log('⚠️  No active users found with valid tokens\n');
      return;
    }

    console.log(`✓ Found ${users.length} active users`);
    console.log(`📤 Adding to queue...\n`);

    const channel = await getRabbitMQChannel();

    // Queue each user for sync
    for (const user of users) {
      const message = {
        userId: user.id,
        characterId: user.character_id,
        characterName: user.character_name,
        queuedAt: new Date().toISOString(),
      };

      channel.sendToQueue(
        QUEUE_NAME,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true, // Survive RabbitMQ restarts
          priority: 5, // Default priority
        }
      );
    }

    console.log(`✅ All ${users.length} users queued successfully!`);
    console.log('💡 Now run the worker to process them: yarn worker:killmail\n');

    await channel.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to queue users:', error);
    process.exit(1);
  }
}

queueKillmailSync();
