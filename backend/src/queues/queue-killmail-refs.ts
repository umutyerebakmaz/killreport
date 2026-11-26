/**
 * Killmail refs publisher: queues the killmails the user and corporation
 * syncs have seen but nobody has written yet.
 *
 * `killmail_refs` is the record; this script turns the pending part of it into
 * `esi_killmail_detail_queue` messages. A ref is pending while `killmails` has
 * no row for it. It is published at once, then at most hourly for five rounds,
 * then daily, so a killmail that failed, parked or was lost with a RabbitMQ
 * reset is tried again without anything remembering the message. The Rust
 * counterpart is `queue:killmail-refs:rs`; see
 * docs/superpowers/specs/2026-11-26-killmail-refs-sync-design.md.
 *
 * Usage: yarn queue:killmail-refs (systemd runs it every five minutes)
 */

import { utcTimestamp } from '@helpers/utc-timestamp';
import {
  buildDetailMessage,
  KILLMAIL_DETAIL_QUEUE,
} from '@services/killmail-detail-message';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import {
  ensureAllQueuesExist,
  getQueueStats,
  getRabbitMQConfirmChannel,
} from '@services/rabbitmq';

/** Refs published per run; the timer comes back in five minutes. */
const BATCH = 5000;
/** Below the live feed's priority: these are kills that already happened. */
const PRIORITY = 5;
const HOUR_MS = 60 * 60 * 1000;

interface PendingRef {
  killmail_id: number;
  killmail_hash: string;
}

/**
 * Publish one batch of pending refs and return how many went out.
 *
 * Skips the run while the detail queue has no consumer: publishing then would
 * only spend the refs' rounds against a worker that is not there. The rounds
 * are counted after the broker confirmed the messages, never before.
 *
 * `announce` is always false: these are kills the live feed missed or old
 * ones from a user's history, not new kills.
 */
export async function publishPendingRefs(
  now: Date = new Date(),
): Promise<number> {
  const stats = await getQueueStats(KILLMAIL_DETAIL_QUEUE);
  if (stats.consumerCount === 0) {
    logger.info(
      `⏭️  ${KILLMAIL_DETAIL_QUEUE} has no consumer, nothing published this run`,
    );
    return 0;
  }

  const hourAgo = utcTimestamp(new Date(now.getTime() - HOUR_MS));
  const dayAgo = utcTimestamp(new Date(now.getTime() - 24 * HOUR_MS));
  const pending = await prismaWorker.$queryRaw<PendingRef[]>`
    SELECT r.killmail_id, r.killmail_hash
    FROM killmail_refs r
    WHERE NOT EXISTS (SELECT 1 FROM killmails k WHERE k.killmail_id = r.killmail_id)
      AND (
        r.last_queued_at IS NULL
        OR (r.queued_count < 5 AND r.last_queued_at < ${hourAgo}::timestamp)
        OR (r.queued_count >= 5 AND r.last_queued_at < ${dayAgo}::timestamp)
      )
    ORDER BY r.killmail_id DESC
    LIMIT 5000
  `;
  if (pending.length === 0) {
    logger.info('✅ no pending killmail refs');
    return 0;
  }

  const channel = await getRabbitMQConfirmChannel();
  try {
    for (const ref of pending) {
      channel.sendToQueue(
        KILLMAIL_DETAIL_QUEUE,
        Buffer.from(
          JSON.stringify(
            buildDetailMessage(ref.killmail_id, ref.killmail_hash, false),
          ),
        ),
        { persistent: true, priority: PRIORITY },
      );
    }
    await channel.waitForConfirms();
  } finally {
    // close() rejects on a channel that already died; the confirm error is
    // the one worth reporting.
    await channel.close().catch(() => {});
  }

  await prismaWorker.$executeRaw`
    UPDATE killmail_refs
    SET queued_count = queued_count + 1, last_queued_at = ${utcTimestamp(now)}::timestamp
    WHERE killmail_id = ANY(${pending.map((r) => r.killmail_id)}::int[])
  `;

  logger.info(
    `📤 queued ${pending.length} pending killmail ref(s) for detail fetch${pending.length === BATCH ? ' (batch full, more next run)' : ''}`,
  );
  return pending.length;
}

async function main() {
  try {
    await ensureAllQueuesExist();
    await publishPendingRefs();
    await prismaWorker.$disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('failed to queue killmail refs', { error });
    await prismaWorker.$disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
