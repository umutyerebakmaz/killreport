import '../config';
import prisma from './prisma';
import { getRabbitMQChannel } from './rabbitmq';

const QUEUE_NAME = 'esi_user_killmails_queue';
const SYNC_INTERVAL_MINUTES = 10; // Sync every 10 minutes

interface UserKillmailMessage {
  userId: number;
  characterId: number;
  characterName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  queuedAt: string;
  lastKillmailId?: number; // For incremental sync optimization
}

/**
 * Background cron service for automatic user killmail syncing
 *
 * This service runs every 10 minutes and:
 * 1. Finds users who haven't been synced in the last 15 minutes
 * 2. Queues them for ESI killmail sync
 * 3. Workers will automatically process them
 *
 * This ensures users' killmails are always up-to-date without manual intervention.
 */
export class UserKillmailCron {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start the cron job
   */
  async start() {
    if (this.intervalId) {
      console.log('⚠️  User killmail cron is already running');
      return;
    }

    console.log('🕐 Starting user killmail background sync...');
    console.log(`   📅 Interval: Every ${SYNC_INTERVAL_MINUTES} minutes`);
    console.log(`   📦 Queue: ${QUEUE_NAME}\n`);

    // Run immediately on start
    await this.syncUsers();

    // Then run every N minutes
    this.intervalId = setInterval(
      () => this.syncUsers(),
      SYNC_INTERVAL_MINUTES * 60 * 1000
    );

    console.log('✅ User killmail cron started\n');
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 User killmail cron stopped');
    }
  }

  /**
   * Queue users who need syncing
   */
  private async syncUsers() {
    // Prevent concurrent runs
    if (this.isRunning) {
      console.log('⏭️  Skipping sync - previous run still in progress');
      return;
    }

    this.isRunning = true;

    try {
      const startTime = Date.now();
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`🕐 [${new Date().toLocaleString('tr-TR')}] Running background sync...`);
      console.log('─'.repeat(70));

      // Get all users with valid tokens (not expired, with 5 minute buffer)
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      const users = await prisma.user.findMany({
        where: {
          expires_at: {
            gt: fiveMinutesFromNow, // Token expires more than 5 minutes from now
          },
          refresh_token: {
            not: null, // Must have refresh token for auto-renewal
          },
          OR: [
            { last_killmail_sync_at: null }, // Never synced
            { last_killmail_sync_at: { lt: fifteenMinutesAgo } }, // Synced > 15 min ago
          ],
        },
        select: {
          id: true,
          character_id: true,
          character_name: true,
          access_token: true,
          refresh_token: true,
          expires_at: true,
          last_killmail_sync_at: true,
          last_killmail_id: true, // For incremental sync optimization
        },
      });

      if (users.length === 0) {
        console.log('   ℹ️  No users need syncing at this time');
        console.log('─'.repeat(70));
        return;
      }

      console.log(`   📊 Found ${users.length} user(s) to sync`);

      const channel = await getRabbitMQChannel();

      // Assert queue with priority support
      await channel.assertQueue(QUEUE_NAME, {
        durable: true,
        arguments: {
          'x-max-priority': 10,
        },
      });

      // Queue each user
      let queuedCount = 0;
      for (const user of users) {
        const lastSyncInfo = user.last_killmail_sync_at
          ? ` (last: ${Math.floor((Date.now() - user.last_killmail_sync_at.getTime()) / 1000 / 60)}m ago)`
          : ' (never)';

        const message: UserKillmailMessage = {
          userId: user.id,
          characterId: user.character_id,
          characterName: user.character_name,
          accessToken: user.access_token,
          refreshToken: user.refresh_token!,
          expiresAt: user.expires_at.toISOString(),
          queuedAt: new Date().toISOString(),
          lastKillmailId: user.last_killmail_id ?? undefined, // For incremental sync
        };

        channel.sendToQueue(
          QUEUE_NAME,
          Buffer.from(JSON.stringify(message)),
          {
            persistent: true,
            priority: 3, // Lower priority for background sync
          }
        );

        console.log(`   ⏳ ${user.character_name}${lastSyncInfo}`);
        queuedCount++;
      }

      const duration = Date.now() - startTime;
      console.log(`\n   ✅ Queued ${queuedCount} user(s) in ${duration}ms`);
      console.log('─'.repeat(70));
    } catch (error: any) {
      console.error(`\n   ❌ Background sync error:`, error.message);
      console.error('─'.repeat(70));
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get status information
   */
  getStatus() {
    return {
      isActive: !!this.intervalId,
      isRunning: this.isRunning,
      intervalMinutes: SYNC_INTERVAL_MINUTES,
    };
  }
}

// Export singleton instance
export const userKillmailCron = new UserKillmailCron();
