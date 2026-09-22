import { publishKillmailDetails } from '../queues/publish-killmail-details';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { ensureAllQueuesExist, getRabbitMQChannel } from '@services/rabbitmq';
import { getCharacterKillmailsFromZKill } from '@services/zkillboard';
import { handleWorkerError } from './worker-error';

const QUEUE_NAME = 'zkillboard_character_queue';
const PREFETCH_COUNT = 1; // Process 1 user at a time (strict zKillboard rate limit: 10s between same endpoint)
const MAX_PAGES = 100; // Fetch up to 100 pages from zKillboard (20,000 killmails max) - Set to 999 for ALL history

// Shutdown flag and interval tracking
let isShuttingDown = false;
let emptyCheckInterval: NodeJS.Timeout | null = null;

interface QueueMessage {
  userId: number;
  characterId: number;
  characterName: string;
  queuedAt: string;
}

/**
 * Background worker for syncing killmails
 * Uses RabbitMQ queue for better scalability and reliability
 */
async function killmailWorker() {
  await ensureAllQueuesExist();
  while (!isShuttingDown) {
    logger.info('🔄 Killmail Worker Started');
    logger.info(`📦 Queue: ${QUEUE_NAME}`);
    logger.info(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent users\n`);

    try {
      const channel = await getRabbitMQChannel();

      // Set prefetch count (how many messages to process concurrently)
      channel.prefetch(PREFETCH_COUNT);

      logger.info('✅ Connected to RabbitMQ');
      logger.info('⏳ Waiting for killmail sync jobs...\n');

      // Add channel error handlers
      channel.on('error', (err) => {
        if (!isShuttingDown) {
          logger.error('💥 Channel error:', err);
        }
      });

      channel.on('close', () => {
        if (!isShuttingDown) {
          logger.warn('⚠️  Channel closed unexpectedly');
        }
      });

      // Consume messages from queue
      await channel.consume(
        QUEUE_NAME,
        async (msg) => {
          if (!msg) return;

          let message: QueueMessage | undefined;

          try {
            message = JSON.parse(msg.content.toString()) as QueueMessage;

            logger.info(`\n${'━'.repeat(60)}`);
            logger.info(
              `👤 Processing: ${message.characterName} (ID: ${message.characterId})`,
            );
            logger.info(`📅 Queued at: ${message.queuedAt}`);
            logger.info('━'.repeat(60));

            await syncUserKillmails(message);

            // Acknowledge message (remove from queue)
            channel.ack(msg);
            logger.info(`✅ Completed: ${message.characterName}\n`);
          } catch (error) {
            // A malformed message throws here too - JSON.parse is inside the
            // try, so it settles through the same shared path rather than
            // escaping the consumer callback unhandled and unsettled.
            // 404, the 420 backoff and the attempt count all live in the
            // shared path now; this worker only says which message it was.
            await handleWorkerError(channel, msg, QUEUE_NAME, error, {
              warn: (m) =>
                logger.warn(`  ${m} (character ${message?.characterId})`),
              error: (m, e) =>
                logger.error(`  ${m} (character ${message?.characterId})`, e),
            });
          }
        },
        { noAck: false }, // Manual acknowledgment
      );

      // Wait indefinitely (until error or shutdown)
      await new Promise(() => {});
    } catch (error) {
      if (isShuttingDown) break;
      logger.error('💥 Worker connection lost, reconnecting in 5s...', error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  // Cleanup
  logger.info('🧹 Worker cleanup completed');
  await prismaWorker.$disconnect();
}

/**
 * Sync killmails for a single user or character
 */
async function syncUserKillmails(message: QueueMessage): Promise<void> {
  try {
    let characterId: number;
    let characterName: string;
    let hasAuth = false;

    // Check if this is a logged-in user or external character
    if (message.userId) {
      // Get user from database with token
      const user = await prismaWorker.user.findUnique({
        where: { id: message.userId },
        select: {
          access_token: true,
          expires_at: true,
          character_id: true,
          character_name: true,
        },
      });

      if (!user) {
        logger.warn(`  ⚠️  User not found in database`);
        return;
      }

      // Check if token is expired
      if (user.expires_at < new Date()) {
        logger.warn(`  ⚠️  Token expired for ${user.character_name}`);
        return;
      }

      characterId = user.character_id;
      characterName = user.character_name;
      hasAuth = true;
    } else {
      // External character (no authentication)
      characterId = message.characterId;
      characterName = message.characterName;
      hasAuth = false;
    }

    logger.info(`\n${'='.repeat(60)}`);
    logger.info(`🚀 Processing Character: ${characterName} (${characterId})`);
    logger.info(
      `   Auth: ${hasAuth ? 'Yes (logged-in user)' : 'No (external character)'}`,
    );
    logger.info(`${'='.repeat(60)}\n`);

    // Fetch killmails from zKillboard (includes ALL history up to MAX_PAGES)
    logger.info(
      `  📡 [${characterName}] Fetching killmails from zKillboard (max ${MAX_PAGES} pages)...`,
    );
    const zkillPackages = await getCharacterKillmailsFromZKill(characterId, {
      maxPages: MAX_PAGES,
      characterName: characterName,
    });

    if (zkillPackages.length === 0) {
      logger.info(`  ℹ️  No killmails found`);
      return;
    }

    logger.info(`  📥 Found ${zkillPackages.length} killmails`);

    // Liste aşaması: detayı çekmez, eksik olanları kuyruğa koyar.
    const queued = await publishKillmailDetails(
      zkillPackages.map((p) => ({
        killmail_id: p.killmail_id,
        killmail_hash: p.zkb.hash,
      })),
      // Bulk history: quiet, and behind anything live.
      { announce: false, priority: 1 },
    );

    logger.info(
      `  📤 Queued ${queued}/${zkillPackages.length} killmail(s) for detail fetch`,
    );
  } catch (error) {
    logger.error(`  ❌ Sync failed:`, error);
    throw error; // Re-throw to trigger message requeue
  }
}

/**
 * Graceful shutdown handler
 */
function setupShutdownHandlers() {
  const shutdown = async () => {
    isShuttingDown = true;
    if (emptyCheckInterval) {
      clearInterval(emptyCheckInterval);
      emptyCheckInterval = null;
    }
    logger.warn('\n\n⚠️  Received shutdown signal');
    logger.warn('🛑 Stopping worker...');
    await prismaWorker.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Start the worker
setupShutdownHandlers();
killmailWorker().catch((error) => {
  logger.error('💥 Worker crashed:', error);
  process.exit(1);
});
