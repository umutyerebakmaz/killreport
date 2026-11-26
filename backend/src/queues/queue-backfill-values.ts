/**
 * Backfill Killmail Values Queue Script
 *
 * Queues killmails for value recalculation. Always recalculates everything.
 * The Rust counterpart is `queue:backfill-values:rs`
 * (`backend-rs/queues/queue-backfill-values`), with the same flags, queue
 * and messages.
 *
 * Usage: yarn queue:backfill-values [--limit=10000] [--capsules-only] [--id=133900250]
 *
 * Filters:
 * - --capsules-only: Only Capsule (pod) killmails: victim ship in group 29,
 *   the Genolution variant included
 * - --id: Process only a specific killmail by ID
 * - --limit: Limit the number of killmails to queue
 *
 * Killmails are read newest ID first, 500 at a time, by `killmail_id` rather
 * than an offset, and never above the largest ID seen at the start: killmails
 * saved while it runs neither shift the pages nor push older ones out. Each
 * page waits for publisher confirms. See
 * docs/superpowers/specs/2026-11-26-rust-backfill-values-design.md.
 */

import { CAPSULE_GROUP_IDS } from '@config/ship-groups';
import type { Prisma } from '@generated/prisma/client';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { ensureAllQueuesExist } from '@services/rabbitmq';
import { publishEntitiesConfirmed } from './publish-entities';

const QUEUE_NAME = 'backfill_killmail_values_queue';
const SOURCE = 'queue-backfill-values';
const BATCH_SIZE = 500;

export interface BackfillArgs {
  limit?: number;
  id?: number;
  capsulesOnly: boolean;
}

function positive(value: string, flag: string): number {
  if (!/^\d+$/.test(value) || Number(value) <= 0) {
    throw new Error(`${flag} must be a positive integer, got "${value}"`);
  }
  return Number(value);
}

/** The flags; a bad value or an unknown flag throws instead of becoming NaN. */
export function parseArgs(argv: string[]): BackfillArgs {
  const args: BackfillArgs = { capsulesOnly: false };
  for (const arg of argv) {
    if (arg === '--capsules-only') {
      args.capsulesOnly = true;
    } else if (arg.startsWith('--limit=')) {
      args.limit = positive(arg.slice('--limit='.length), '--limit');
    } else if (arg.startsWith('--id=')) {
      args.id = positive(arg.slice('--id='.length), '--id');
    } else {
      throw new Error(
        `unknown argument "${arg}"; use --limit=N, --id=K, --capsules-only`,
      );
    }
  }
  return args;
}

/** Which killmails a run covers. Capsules by group, as the formula does. */
export async function backfillWhere(
  args: BackfillArgs,
): Promise<Prisma.KillmailWhereInput> {
  if (args.id !== undefined) return { killmail_id: args.id };
  if (!args.capsulesOnly) return {};
  const capsules = await prismaWorker.type.findMany({
    where: { group_id: { in: CAPSULE_GROUP_IDS } },
    select: { id: true },
  });
  return { victim: { ship_type_id: { in: capsules.map((t) => t.id) } } };
}

/** Queue the matching killmails; resolves to how many were confirmed. */
export async function queueBackfillValues(args: BackfillArgs): Promise<number> {
  const where = await backfillWhere(args);
  const targetDesc =
    args.id !== undefined
      ? 'killmail'
      : args.capsulesOnly
        ? 'capsule killmails'
        : 'killmails';

  const [totalCount, aggregate] = await Promise.all([
    prismaWorker.killmail.count({ where }),
    prismaWorker.killmail.aggregate({ where, _max: { killmail_id: true } }),
  ]);
  const maxId = aggregate._max.killmail_id;

  if (totalCount === 0 || maxId === null) {
    if (args.id !== undefined) {
      logger.info(`❌ killmail ${args.id} not found!`);
    } else {
      logger.info(`✅ no ${targetDesc} found matching the criteria!`);
      logger.info('nothing to backfill.');
    }
    return 0;
  }

  const toProcess =
    args.limit !== undefined ? Math.min(args.limit, totalCount) : totalCount;
  logger.info(
    `📊 found ${totalCount.toLocaleString()} ${targetDesc} matching criteria`,
  );
  if (args.limit !== undefined) {
    logger.info(`🎯 processing limit: ${toProcess.toLocaleString()} killmails`);
  }
  logger.info(`📦 queue: ${QUEUE_NAME}`);
  logger.info(`⚙️  batch size: ${BATCH_SIZE}`);

  let queuedCount = 0;
  let batchNumber = 0;
  let below = maxId + 1;

  while (queuedCount < toProcess) {
    const killmails = await prismaWorker.killmail.findMany({
      where: { AND: [where, { killmail_id: { lt: below } }] },
      select: { killmail_id: true },
      orderBy: { killmail_id: 'desc' },
      take: Math.min(BATCH_SIZE, toProcess - queuedCount),
    });
    if (killmails.length === 0) break;

    const ids = killmails.map((k) => k.killmail_id);
    queuedCount += await publishEntitiesConfirmed(QUEUE_NAME, SOURCE, ids, {
      idField: 'killmailId',
    });
    below = ids[ids.length - 1];
    batchNumber++;

    const progress = ((queuedCount / toProcess) * 100).toFixed(1);
    logger.info(
      `  📤 queued batch ${batchNumber} ` +
        `(${queuedCount.toLocaleString()}/${toProcess.toLocaleString()} - ${progress}%)`,
    );
  }

  logger.info(
    `✅ successfully queued ${queuedCount.toLocaleString()} ${targetDesc}`,
  );
  logger.info('🚀 start the worker with: yarn worker:backfill-values');
  return queuedCount;
}

async function main() {
  let args: BackfillArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    logger.error((error as Error).message);
    process.exit(1);
  }

  const title =
    args.id !== undefined
      ? `🎯 Backfill Single Killmail Value - killmail ID: ${args.id}`
      : args.capsulesOnly
        ? '🚀 Backfill CAPSULE Killmail Values (victim ship group 29)'
        : '🔄 Backfill Killmail Values';
  logger.info(`${title} - queue script`);

  try {
    await ensureAllQueuesExist();
    await queueBackfillValues(args);
    await prismaWorker.$disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('failed to queue backfill values', { error });
    await prismaWorker.$disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
