import { CorporationService } from '@services/corporation/corporation.service';
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
import { handleWorkerError, isForbidden } from './worker-error';

const QUEUE_NAME = 'esi_corporation_killmails_queue';
const PREFETCH_COUNT = 1;

/** NPC corporations: no corporation killmails, and ESI answers 403. */
export function isNpcCorporation(corporationId: number): boolean {
  return corporationId >= 1_000_000 && corporationId < 2_000_000;
}

/**
 * ESI corporation killmail sync.
 *
 * Reads a corporation's killmail list with a member's token (Director/CEO
 * and `esi-killmails.read_corporation_killmails.v1`) and records every
 * killmail it lists in `killmail_refs`; `queue:killmail-refs` feeds the
 * detail queue from there. The Rust counterpart is
 * `worker:corporation-killmails:rs`; see
 * docs/superpowers/specs/2026-11-26-killmail-refs-sync-design.md.
 *
 * Usage: yarn worker:corporation-killmails
 */
export async function esiCorporationKillmailWorker() {
  logger.info('🔄 ESI corporation killmail worker started');
  logger.info(`📦 queue: ${QUEUE_NAME}`);
  logger.info(`⚡ prefetch: ${PREFETCH_COUNT} concurrent corporations`);
  logger.info(
    `🔐 required: Director/CEO + esi-killmails.read_corporation_killmails.v1\n`,
  );

  try {
    await ensureAllQueuesExist();
    const channel = await getRabbitMQChannel();
    channel.prefetch(PREFETCH_COUNT);

    logger.info('✅ connected to RabbitMQ');
    logger.info('⏳ waiting for corporation killmail jobs...\n');

    await channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (!msg) return;

        let message: KillmailSyncMessage | undefined;
        try {
          message = JSON.parse(msg.content.toString()) as KillmailSyncMessage;
          await syncCorporation(message);
          channel.ack(msg);
        } catch (error) {
          // A malformed message throws here too - JSON.parse is inside the
          // try. 404, throttles, an SSO outage and the attempt count all
          // live in the shared path.
          await handleWorkerError(channel, msg, QUEUE_NAME, error, {
            warn: (m) => logger.warn(`  ${m} (user ${message?.userId})`),
            error: (m, e) =>
              logger.error(`  ${m} (user ${message?.userId})`, e),
          });
        }
      },
      { noAck: false },
    );
  } catch (error) {
    logger.error('💥 worker failed to start:', error);
    process.exit(1);
  }
}

/**
 * One user's corporation sync: record what ESI lists, then stamp the user.
 *
 * The corporation comes from `characters`, kept current by
 * `worker:info:characters`; `users.corporation_id` was never written. A
 * character not fetched yet, or one in an NPC corporation, is stamped and
 * skipped.
 *
 * A 403 means the user is not a Director/CEO or lacks the scope. Retrying
 * cannot change either, so it is recorded in `corp_killmails_denied_at`;
 * the cron stops selecting the user for this job until the next login
 * clears it (`auth-callback.handler.ts`).
 */
export async function syncCorporation(
  message: KillmailSyncMessage,
  now: Date = new Date(),
): Promise<'synced' | 'skipped' | 'denied'> {
  const credentials = await loadUserCredentials(message.userId, prismaWorker);
  if (!credentials.ok) {
    logger.warn(
      `  ⏭️  user ${message.userId}: ${credentials.reason}, skipping until the next login`,
    );
    return 'skipped';
  }

  const { user, accessToken } = credentials;
  const stamp = () =>
    prismaWorker.user.update({
      where: { id: user.id },
      data: { last_corp_killmail_sync_at: now },
    });

  const character = await prismaWorker.character.findUnique({
    where: { id: user.character_id },
    select: { corporation_id: true },
  });
  const corporationId = character?.corporation_id;
  if (!corporationId || isNpcCorporation(corporationId)) {
    logger.info(
      `  ⏭️  ${user.character_name}: ${corporationId ? 'NPC corporation' : 'character not fetched yet'}, skipping`,
    );
    await stamp();
    return 'skipped';
  }

  const fullSync = isFullSync(
    user.last_corp_killmail_sync_at,
    message.fullSync ?? false,
  );

  let walk;
  try {
    walk = await walkKillmails(
      (page) =>
        CorporationService.getKillmailPage(
          corporationId,
          accessToken,
          user.character_id,
          page,
        ),
      (refs) => recordRefs(refs, 'corporation', now),
      fullSync,
    );
  } catch (error) {
    if (!isForbidden(error)) throw error;
    await prismaWorker.user.update({
      where: { id: user.id },
      data: { corp_killmails_denied_at: now, last_corp_killmail_sync_at: now },
    });
    logger.warn(
      `  ! ${user.character_name}: ESI returned 403 - not a Director/CEO, or missing esi-killmails.read_corporation_killmails.v1. not retried until the next login.`,
    );
    return 'denied';
  }

  if (walk.capped) {
    logger.warn(
      `  ⚠️  corporation ${corporationId}: stopped at the page cap; older killmails were not read`,
    );
  }
  await stamp();

  logger.info(
    `✅ corporation ${corporationId} (${user.character_name}): ${walk.found} listed on ${walk.pages} page(s), ${walk.inserted} new${fullSync ? ' (full sync)' : ''}`,
  );
  return 'synced';
}

function setupShutdownHandlers() {
  process.on('SIGINT', () => {
    logger.info('\n⚠️  received SIGINT, shutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('\n⚠️  received SIGTERM, shutting down gracefully...');
    process.exit(0);
  });
}

// Start the worker only if run directly (not imported)
if (require.main === module) {
  setupShutdownHandlers();
  esiCorporationKillmailWorker().catch((error) => {
    logger.error('💥 worker crashed:', error);
    process.exit(1);
  });
}
