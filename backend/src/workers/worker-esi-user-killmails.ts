import { CharacterService } from '@services/character/character.service';
import { type KillmailSyncMessage } from '@services/killmail-sync-message';
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
    logger.info('🔄 ESI user killmail worker started');
    logger.info(`📦 queue: ${QUEUE_NAME}`);
    logger.info(`⚡ prefetch: ${PREFETCH_COUNT} concurrent users`);
    logger.info(`🌐 data source: ESI API (direct, no zKillboard)\n`);

    try {
      const channel = await getRabbitMQChannel();

      // Set prefetch to limit concurrent processing
      channel.prefetch(PREFETCH_COUNT);

      logger.info('✅ connected to RabbitMQ');
      logger.info('⏳ waiting for user killmail jobs...\n');

      // Add channel error handlers
      channel.on('error', (err) => {
        if (!isShuttingDown) {
          logger.error('💥 channel error:', err);
        }
      });

      channel.on('close', () => {
        if (!isShuttingDown) {
          logger.warn('⚠️  channel closed unexpectedly');
        }
      });

      // Consume messages
      await channel.consume(
        QUEUE_NAME,
        async (msg) => {
          if (!msg) {
            logger.warn('⚠️  received null message from RabbitMQ');
            return;
          }

          logger.info('📨 received message from queue!');

          let message: KillmailSyncMessage | undefined;

          try {
            message = JSON.parse(msg.content.toString()) as KillmailSyncMessage;

            logger.info(`\n${'━'.repeat(70)}`);
            logger.info(`🆔 user ID: ${message.userId}`);
            logger.info(`📅 queued at: ${message.queuedAt}`);
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
              logger.error(`  ⏭️  skipping user - requires re-login via SSO`);
              channel.ack(msg);
              return;
            }

            const { user, accessToken } = credentials;

            logger.info(
              `👤 processing: ${user.character_name} (ID: ${user.character_id})`,
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
            logger.info(`✅ completed: ${user.character_name}\n`);

            // Add delay between users to prevent rate limiting
            // This is critical when multiple users are queued
            logger.debug(
              `⏸️  waiting 10 seconds before next user to prevent rate limiting...\n`,
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

      logger.info(`📢 consumer started`);
      logger.info(`📊 ready to process messages from ${QUEUE_NAME}\n`);

      // Wait indefinitely (until error or shutdown)
      await new Promise(() => {});
    } catch (error) {
      if (isShuttingDown) break;
      logger.error('💥 worker connection lost, reconnecting in 5s...', error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  // Cleanup
  logger.info('🧹 worker cleanup completed');
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
        `  📡 [${ctx.characterName}] fetching new killmails from ESI (incremental sync)...`,
      );
      logger.info(`     🔍 will stop at killmail ID: ${lastKillmailId}`);
      logger.info(
        `     📄 max pages: 50 (will stop earlier if last synced killmail is found)`,
      );
    } else {
      logger.info(
        `  📡 [${ctx.characterName}] fetching killmails from ESI (full sync)...`,
      );
      logger.info(`     📄 max pages: 50 (2,500 killmails max - 50 per page)`);
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
      `  📤 queued ${queued}/${killmailList.length} killmail(s) for detail fetch`,
    );

    // When this user was last handled — not the cursor. The cursor is derived
    // from killmail_filters via `lastStoredKillmailId`; read the warning there,
    // it does not repair itself. What reads this stamp is killmail-sync-cron's
    // 15-minute window, and null means "never synced": the cron publishes it
    // as a full sync.
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
    logger.warn('\n⚠️  received shutdown signal, shutting down gracefully...');
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
    logger.error('💥 worker crashed:', error);
    process.exit(1);
  });
}
