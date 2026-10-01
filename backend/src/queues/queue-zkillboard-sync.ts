import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { ensureAllQueuesExist, getRabbitMQChannel } from '@services/rabbitmq';

const QUEUE_NAME = 'zkillboard_character_queue';

/**
 * Queue all active users for killmail sync
 * Similar to alliance queue but for user killmail syncing
 */
async function queueKillmailSync() {
  logger.info('queueing users for killmail sync...');

  try {
    // Get all users with valid tokens
    const users = await prismaWorker.user.findMany({
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
      logger.warn('no active users found with valid tokens');
      return;
    }

    logger.info(`found ${users.length} active users`);
    logger.info('adding to queue...');

    await ensureAllQueuesExist();
    const channel = await getRabbitMQChannel();

    // Queue each user for sync
    for (const user of users) {
      const message = {
        userId: user.id,
        characterId: user.character_id,
        characterName: user.character_name,
        queuedAt: new Date().toISOString(),
      };

      channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
        persistent: true, // Survive RabbitMQ restarts
        priority: 5, // Default priority
      });
    }

    logger.info(`all ${users.length} users queued successfully!`);
    logger.info('now run the worker to process them: yarn worker:zkillboard');

    await channel.close();
    process.exit(0);
  } catch (error) {
    logger.error('failed to queue users', { error });
    process.exit(1);
  }
}

queueKillmailSync();
