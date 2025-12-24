import '../config';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_user_killmails_queue';

interface UserKillmailMessage {
  userId: number;
  characterId: number;
  characterName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  queuedAt: string;
}

/**
 * Queue logged-in users for ESI killmail sync (no zKillboard dependency)
 * Fetches killmails directly from ESI API using user's access token
 *
 * Usage: yarn queue:user-killmails
 *
 * This will queue all active users (with valid SSO tokens) for killmail sync.
 * The worker will fetch their recent killmails from ESI API.
 */
async function queueUserESIKillmails() {
  console.log('📡 Queueing users for ESI killmail sync...\n');

  try {
    // Get all users with valid tokens (not expired, with 5 minute buffer)
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    const users = await prisma.user.findMany({
      where: {
        expires_at: {
          gt: fiveMinutesFromNow, // Token expires more than 5 minutes from now
        },
        refresh_token: {
          not: null, // Must have refresh token for auto-renewal
        },
      },
      select: {
        id: true,
        character_id: true,
        character_name: true,
        access_token: true,
        refresh_token: true,
        expires_at: true,
      },
    });

    if (users.length === 0) {
      console.log('⚠️  No active users found with valid tokens\n');
      console.log('💡 Users need to login via SSO first.\n');
      return;
    }

    console.log(`✓ Found ${users.length} active user(s) with valid tokens`);
    console.log(`📤 Adding to queue: ${QUEUE_NAME}\n`);

    const channel = await getRabbitMQChannel();

    // Assert queue with priority support
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: {
        'x-max-priority': 10,
      },
    });

    // Queue each user
    for (const user of users) {
      const message: UserKillmailMessage = {
        userId: user.id,
        characterId: user.character_id,
        characterName: user.character_name,
        accessToken: user.access_token,
        refreshToken: user.refresh_token!,
        expiresAt: user.expires_at.toISOString(),
        queuedAt: new Date().toISOString(),
      };

      channel.sendToQueue(
        QUEUE_NAME,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          priority: 5, // Medium priority
        }
      );

      console.log(`  ⏳ Queued: ${user.character_name} (ID: ${user.character_id})`);
    }

    console.log(`\n✅ Successfully queued ${users.length} user(s)!`);
    console.log(`\n💡 Now run the worker to process them:`);
    console.log(`   yarn worker:user-killmails\n`);

    await channel.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to queue users:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

queueUserESIKillmails();
