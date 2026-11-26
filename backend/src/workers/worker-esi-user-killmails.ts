import { CharacterService } from '@services/character/character.service';
import { recordRefs } from '@services/killmail-refs';
import {
  isFullSync,
  type KillmailSyncMessage,
} from '@services/killmail-sync-message';
import { walkKillmails } from '@services/killmail-walk';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { ensureAllQueuesExist, getRabbitMQChannel } from '@services/rabbitmq';
import { loadUserCredentials } from '@services/user-credentials';
import { handleWorkerError } from './worker-error';

const QUEUE_NAME = 'esi_user_killmails_queue';
const PREFETCH_COUNT = 1;

// Shutdown flag
let isShuttingDown = false;

/**
 * ESI killmail sync for logged-in users.
 *
 * Reads the character's own killmail list with their token and records every
 * killmail it lists in `killmail_refs`. It publishes nothing: the detail queue
 * is fed from that table by `queue:killmail-refs`, so a killmail this sync saw
 * is fetched eventually even if a message is lost or parked. The Rust
 * counterpart is `worker:user-killmails:rs`; see
 * docs/superpowers/specs/2026-11-26-killmail-refs-sync-design.md.
 *
 * Usage: yarn worker:user-killmails
 */
export async function esiUserKillmailWorker() {
  await ensureAllQueuesExist();
  while (!isShuttingDown) {
    logger.info('🔄 ESI user killmail worker started');
    logger.info(`📦 queue: ${QUEUE_NAME}`);
    logger.info(`⚡ prefetch: ${PREFETCH_COUNT} concurrent users`);

    try {
      const channel = await getRabbitMQChannel();
      channel.prefetch(PREFETCH_COUNT);

      logger.info('✅ connected to RabbitMQ');
      logger.info('⏳ waiting for user killmail jobs...\n');

      channel.on('error', (err) => {
        if (!isShuttingDown) logger.error('💥 channel error:', err);
      });
      channel.on('close', () => {
        if (!isShuttingDown) logger.warn('⚠️  channel closed unexpectedly');
      });

      await channel.consume(
        QUEUE_NAME,
        async (msg) => {
          if (!msg) {
            logger.warn('⚠️  received null message from RabbitMQ');
            return;
          }

          let message: KillmailSyncMessage | undefined;
          try {
            message = JSON.parse(msg.content.toString()) as KillmailSyncMessage;
            await syncUser(message);
            channel.ack(msg);
          } catch (error) {
            // A malformed message throws here too - JSON.parse is inside the
            // try, so it settles through the same shared path. 404, throttles,
            // an SSO outage and the attempt count all live there.
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
      // Wait indefinitely (until error or shutdown)
      await new Promise(() => {});
    } catch (error) {
      if (isShuttingDown) break;
      logger.error('💥 worker connection lost, reconnecting in 5s...', error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  logger.info('🧹 worker cleanup completed');
  await prismaWorker.$disconnect();
}

/**
 * One user's character sync: record what ESI lists, then stamp the user.
 *
 * `skipped` when the user cannot be synced until they log in again (no
 * refresh token, a revoked grant, the user gone); those are acked, because no
 * retry helps. A failure part-way through the walk keeps the pages already
 * recorded and throws before the stamp, so the user is selected again.
 */
export async function syncUser(
  message: KillmailSyncMessage,
  now: Date = new Date(),
): Promise<'synced' | 'skipped'> {
  const credentials = await loadUserCredentials(message.userId, prismaWorker);
  if (!credentials.ok) {
    logger.warn(
      `  ⏭️  user ${message.userId}: ${credentials.reason}, skipping until the next login`,
    );
    return 'skipped';
  }

  const { user, accessToken } = credentials;
  const fullSync = isFullSync(
    user.last_killmail_sync_at,
    message.fullSync ?? false,
  );

  const walk = await walkKillmails(
    (page) =>
      CharacterService.getKillmailPage(user.character_id, accessToken, page),
    (refs) => recordRefs(refs, 'character', now),
    fullSync,
  );
  if (walk.capped) {
    logger.warn(
      `  ⚠️  ${user.character_name}: stopped at the page cap; older killmails were not read`,
    );
  }

  // When this user was last handled; killmail-sync-cron's 15-minute window
  // reads it, and null means "never synced" (a full sync).
  await prismaWorker.user.update({
    where: { id: user.id },
    data: { last_killmail_sync_at: now },
  });

  logger.info(
    `✅ ${user.character_name}: ${walk.found} listed on ${walk.pages} page(s), ${walk.inserted} new${fullSync ? ' (full sync)' : ''}`,
  );
  return 'synced';
}

function setupShutdownHandlers() {
  const shutdown = async () => {
    isShuttingDown = true;
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
