import { CharacterService } from '@services/character/character.service';
import { type KillmailSyncMessage } from '@services/killmail-sync-message';
import { KillmailService } from '@services/killmail/killmail.service';
import { lastStoredKillmailId } from '@services/killmail-cursor';
import { publishKillmailDetails } from '../queues/publish-killmail-details';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { ensureAllQueuesExist, getRabbitMQChannel } from '@services/rabbitmq';
import { loadUserCredentials } from '@services/user-credentials';
import { handleWorkerError } from './worker-error';

const QUEUE_NAME = 'esi_user_killmails_queue';
const PREFETCH_COUNT = 1; // Process 1 user at a time to avoid rate limiting

// Shutdown flag and interval tracking
let isShuttingDown = false;
let emptyCheckInterval: NodeJS.Timeout | null = null;

/** What one character sync needs, resolved from the database up front. */
interface UserSyncContext {
  userId: number;
  characterId: number;
  characterName: string;
  accessToken: string;
}

/**
 * ESI-only killmail worker for logged-in users
 *
 * This worker fetches killmails directly from ESI API using user's access token.
 * No zKillboard dependency - completely independent system.
 *
 * Features:
 * - Fetches recent killmails from ESI (up to 100 pages = 2500 killmails)
 * - Automatically enriches related entities (characters, corps, etc.)
 * - Publishes GraphQL subscription events for real-time updates
 * - Handles duplicates gracefully
 * - Respects ESI rate limits
 *
 * Usage: yarn worker:user-killmails
 * Or: Start with server process via ENABLE_USER_KILLMAIL_WORKER=true
 */
export async function esiUserKillmailWorker() {
  await ensureAllQueuesExist();
  while (!isShuttingDown) {
    logger.info('🔄 ESI User Killmail Worker Started');
    logger.info(`📦 Queue: ${QUEUE_NAME}`);
    logger.info(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent users`);
    logger.info(`🌐 Data Source: ESI API (direct, no zKillboard)\n`);

    try {
      const channel = await getRabbitMQChannel();

      // Set prefetch to limit concurrent processing
      channel.prefetch(PREFETCH_COUNT);

      logger.info('✅ Connected to RabbitMQ');
      logger.info('⏳ Waiting for user killmail jobs...\n');

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

      // Consume messages
      await channel.consume(
        QUEUE_NAME,
        async (msg) => {
          if (!msg) {
            logger.warn('⚠️  Received null message from RabbitMQ');
            return;
          }

          logger.info('📨 Received message from queue!');

          let message: KillmailSyncMessage | undefined;

          try {
            message = JSON.parse(msg.content.toString()) as KillmailSyncMessage;

            logger.info(`\n${'━'.repeat(70)}`);
            logger.info(`🆔 User ID: ${message.userId}`);
            logger.info(`📅 Queued at: ${message.queuedAt}`);
            logger.info('━'.repeat(70));

            const credentials = await loadUserCredentials(
              message.userId,
              prismaWorker,
            );

            if (!credentials.ok) {
              // None of these is retryable: the user has to log in again
              // before any attempt can succeed. Ack and move on.
              logger.error(
                `  ❌ ${credentials.reason} for user ${message.userId}`,
              );
              logger.error(`  ⏭️  Skipping user - requires re-login via SSO`);
              channel.ack(msg);
              return;
            }

            const { user, accessToken } = credentials;

            logger.info(
              `👤 Processing: ${user.character_name} (ID: ${user.character_id})`,
            );

            const lastKillmailId = message.fullSync
              ? undefined
              : await lastStoredKillmailId({
                  characterId: user.character_id,
                });

            await syncUserKillmailsFromESI(
              {
                userId: user.id,
                characterId: user.character_id,
                characterName: user.character_name,
                accessToken,
              },
              lastKillmailId,
            );

            // Acknowledge message
            channel.ack(msg);
            logger.info(`✅ Completed: ${user.character_name}\n`);

            // Add delay between users to prevent rate limiting
            // This is critical when multiple users are queued
            logger.debug(
              `⏸️  Waiting 10 seconds before next user to prevent rate limiting...\n`,
            );
            await new Promise((resolve) => setTimeout(resolve, 10000));
          } catch (error) {
            // A malformed message throws here too - JSON.parse is inside the
            // try, so it settles through the same shared path rather than
            // escaping the consumer callback unhandled and unsettled.
            // 404, the 420 backoff and the attempt count all live in the
            // shared path now; this worker only says which message it was.
            await handleWorkerError(channel, msg, QUEUE_NAME, error, {
              warn: (m) => logger.warn(`  ${m} (user ${message?.userId})`),
              error: (m, e) =>
                logger.error(`  ${m} (user ${message?.userId})`, e),
            });
          }
        },
        { noAck: false },
      );

      logger.info(`📢 Consumer started`);
      logger.info(`📊 Ready to process messages from ${QUEUE_NAME}\n`);

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
 * Fetch killmails from ESI for a single user
 */
async function syncUserKillmailsFromESI(
  ctx: UserSyncContext,
  lastKillmailId?: number,
): Promise<void> {
  try {
    if (lastKillmailId) {
      logger.info(
        `  📡 [${ctx.characterName}] Fetching NEW killmails from ESI (incremental sync)...`,
      );
      logger.info(`     🔍 Will stop at killmail ID: ${lastKillmailId}`);
      logger.info(
        `     📄 Max pages: 50 (will stop earlier if last synced killmail is found)`,
      );
    } else {
      logger.info(
        `  📡 [${ctx.characterName}] Fetching killmails from ESI (full sync)...`,
      );
      logger.info(`     📄 Max pages: 50 (2,500 killmails max - 50 per page)`);
    }

    // Fetch killmail list from ESI (max 50 pages = 2500 killmails, 50 per page)
    // ESI returns killmails in reverse chronological order (newest first)
    const killmailList = await CharacterService.getCharacterKillmails(
      ctx.characterId,
      ctx.accessToken,
      50, // Max pages (50 killmails per page)
      lastKillmailId, // Stop when we hit this ID (incremental sync)
    );

    const queued = await publishKillmailDetails(
      killmailList.map((km) => ({
        killmail_id: km.killmail_id,
        killmail_hash: km.killmail_hash,
      })),
      { announce: true, priority: 5 },
    );

    logger.info(
      `  📤 Queued ${queued}/${killmailList.length} killmail(s) for detail fetch`,
    );

    // Bu kullanıcının en son ne zaman ele alındığı — imleç değil. İmleç artık
    // killmail_filters'tan türetiliyor (`lastStoredKillmailId`); burada yazılan
    // bir imleç "kuyruğa kondu" demek olurdu ve parking'e düşen bir killmail'in
    // üzerinden geçerdi. Bu damgaya bakan şey killmail-sync-cron'un 15
    // dakikalık penceresi.
    await prismaWorker.user.update({
      where: { id: ctx.userId },
      data: { last_killmail_sync_at: new Date() },
    });
  } catch (error: any) {
    logger.error(
      `  ❌ ESI sync failed for ${ctx.characterName}:`,
      error.message,
    );
    throw error;
  }
}

/**
 * Graceful shutdown handlers
 */
function setupShutdownHandlers() {
  const shutdown = async () => {
    isShuttingDown = true;
    if (emptyCheckInterval) {
      clearInterval(emptyCheckInterval);
      emptyCheckInterval = null;
    }
    logger.warn('\n⚠️  Received shutdown signal, shutting down gracefully...');
    await prismaWorker.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Start the worker only if run directly (not imported)
if (require.main === module) {
  setupShutdownHandlers();
  esiUserKillmailWorker().catch((error) => {
    logger.error('💥 Worker crashed:', error);
    process.exit(1);
  });
}
