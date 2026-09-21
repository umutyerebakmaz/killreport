import { buildSyncMessage } from '@services/killmail-sync-message';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { ensureAllQueuesExist, getRabbitMQChannel } from '@services/rabbitmq';

const QUEUE_NAME = 'esi_user_killmails_queue';

/**
 * Queue logged-in users for ESI killmail sync (no zKillboard dependency)
 * Fetches killmails directly from ESI API using user's access token
 *
 * Usage:
 *   yarn queue:user-killmails [--force] [--full]
 *
 * Options:
 *   --force  Queue all users regardless of last sync time
 *   --full   Disable incremental sync (fetch all killmails, not just new ones)
 *
 * By default, only queues users who haven't been synced in the last 15 minutes.
 * Use --force to queue all users regardless of last sync time.
 * Use --full to disable incremental sync and fetch all killmails from scratch.
 *
 * This will queue all active users (with valid SSO tokens) for killmail sync.
 * The worker will fetch their recent killmails from ESI API.
 */
async function queueUserESIKillmails() {
  const forceSync = process.argv.includes('--force');
  const fullSync = process.argv.includes('--full');
  logger.info('Queueing users for ESI killmail sync...');

  if (forceSync) {
    logger.info('Force mode: Ignoring last sync time');
  }
  if (fullSync) {
    logger.info(
      'Full sync mode: Disabled incremental sync (will fetch all killmails)',
    );
  }

  try {
    // Get all users with valid tokens (not expired, with 5 minute buffer)
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const users = await prismaWorker.user.findMany({
      where: {
        expires_at: {
          gt: fiveMinutesFromNow, // Token expires more than 5 minutes from now
        },
        refresh_token: {
          not: null, // Must have refresh token for auto-renewal
        },
        // Only queue users who haven't been synced recently (unless force mode)
        ...(forceSync
          ? {}
          : {
              OR: [
                { last_killmail_sync_at: null }, // Never synced
                { last_killmail_sync_at: { lt: fifteenMinutesAgo } }, // Synced > 15 min ago
              ],
            }),
      },
      select: {
        id: true,
        character_id: true,
        character_name: true,
        expires_at: true,
        last_killmail_sync_at: true,
      },
    });

    if (users.length === 0) {
      logger.warn('No active users found for sync');
      if (!forceSync) {
        logger.info('All users were synced recently (within 15 minutes).');
        logger.info(
          '  Use --force to sync anyway: yarn queue:user-killmails --force',
        );
      } else {
        logger.info('Users need to login via SSO first.');
      }
      return;
    }

    logger.info(`Found ${users.length} user(s) to sync`);
    logger.info(`Adding to queue: ${QUEUE_NAME}`);

    await ensureAllQueuesExist();
    const channel = await getRabbitMQChannel();

    // Queue each user
    for (const user of users) {
      const lastSyncInfo = user.last_killmail_sync_at
        ? ` (last sync: ${user.last_killmail_sync_at.toLocaleString('tr-TR')})`
        : ' (never synced)';

      const message = buildSyncMessage(user.id, fullSync);

      channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
        persistent: true,
        priority: 5, // Medium priority,
      });

      const syncMode = fullSync ? ' [FULL SYNC]' : ' [INCREMENTAL]';
      logger.debug(
        `Queued: ${user.character_name} (ID: ${user.character_id})${lastSyncInfo}${syncMode}`,
      );
    }

    logger.info(`Successfully queued ${users.length} user(s)!`);
    logger.info('Now run the worker to process them:');
    logger.info('  yarn worker:user-killmails');

    await channel.close();
    await prismaWorker.$disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Failed to queue users', { error });
    await prismaWorker.$disconnect();
    process.exit(1);
  }
}

queueUserESIKillmails();
