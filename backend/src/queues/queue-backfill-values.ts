/**
 * Backfill Killmail Values Queue Script
 *
 * Queues killmails for value recalculation. Always recalculates everything.
 *
 * Usage: yarn queue:backfill-values [--limit=10000] [--capsules-only] [--id=133900250]
 *
 * Filters:
 * - --capsules-only: Only process Capsule (pod) killmails (type_id: 670)
 * - --id: Process only a specific killmail by ID
 * - --limit: Limit the number of killmails to queue
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { ensureAllQueuesExist, getRabbitMQChannel } from '@services/rabbitmq';

const QUEUE_NAME = 'backfill_killmail_values_queue';
const BATCH_SIZE = 500; // Process in batches of 500
const CAPSULE_TYPE_ID = 670; // EVE Online Capsule type_id

interface BackfillMessage {
  killmailId: number;
  queuedAt: string;
  source: string;
}

function getWhereClause(capsulesOnly: boolean) {
  return capsulesOnly ? { victim: { ship_type_id: CAPSULE_TYPE_ID } } : {};
}

async function queueBackfillValues() {
  const args = process.argv.slice(2);
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;

  const capsulesOnly = args.includes('--capsules-only');

  const killmailIdArg = args.find((arg) => arg.startsWith('--id='));
  const killmailId = killmailIdArg
    ? parseInt(killmailIdArg.split('=')[1])
    : undefined;

  const scriptTitle = killmailId
    ? '🎯 Backfill Single Killmail Value'
    : capsulesOnly
      ? '🚀 Backfill CAPSULE Killmail Values'
      : '🔄 Backfill Killmail Values';
  logger.info(`${scriptTitle} - queue script`);
  logger.info('━'.repeat(60));
  if (killmailId) {
    logger.info(`🎯 killmail ID: ${killmailId}`);
  } else if (capsulesOnly) {
    logger.info(
      `🛸 filter: capsule (pod) killmails only (type_id: ${CAPSULE_TYPE_ID})`,
    );
  }

  try {
    const whereClause = killmailId
      ? { killmail_id: killmailId }
      : getWhereClause(capsulesOnly);

    // Count total killmails matching the criteria
    const totalCount = await prismaWorker.killmail.count({
      where: whereClause,
    });

    if (totalCount === 0) {
      if (killmailId) {
        logger.info(`❌ killmail ${killmailId} not found!`);
      } else {
        const target = capsulesOnly ? 'Capsule killmails' : 'killmails';
        logger.info(`✅ no ${target} found matching the criteria!`);
        logger.info('nothing to backfill.');
      }
      process.exit(0);
    }

    const toProcess = limit ? Math.min(limit, totalCount) : totalCount;

    const targetDesc = killmailId
      ? 'killmail'
      : capsulesOnly
        ? 'Capsule killmails'
        : 'killmails';
    if (killmailId) {
      logger.info(`✅ found killmail ${killmailId}`);
    } else {
      logger.info(
        `📊 found ${totalCount.toLocaleString()} ${targetDesc} matching criteria`,
      );
      if (limit) {
        logger.info(
          `🎯 processing limit: ${toProcess.toLocaleString()} killmails`,
        );
      }
    }
    logger.info(`📦 queue: ${QUEUE_NAME}`);
    logger.info(`⚙️  batch size: ${BATCH_SIZE}`);
    logger.info('');

    await ensureAllQueuesExist();
    const channel = await getRabbitMQChannel();

    logger.info('⏳ fetching killmail IDs...');

    // Fetch killmail IDs in batches (to avoid loading millions of IDs in memory)
    let queuedCount = 0;
    let batchNumber = 0;

    while (queuedCount < toProcess) {
      const take = Math.min(BATCH_SIZE, toProcess - queuedCount);

      const killmails = await prismaWorker.killmail.findMany({
        where: whereClause,
        select: { killmail_id: true },
        orderBy: { killmail_time: 'desc' }, // Process newest first
        skip: batchNumber * BATCH_SIZE,
        take,
      });

      if (killmails.length === 0) break;

      // Queue each killmail
      for (const km of killmails) {
        const message: BackfillMessage = {
          killmailId: km.killmail_id,
          queuedAt: new Date().toISOString(),
          source: 'queue-backfill-values',
        };

        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
          persistent: true,
        });

        queuedCount++;
      }

      batchNumber++;
      const progress = ((queuedCount / toProcess) * 100).toFixed(1);
      logger.info(
        `  📤 queued batch ${batchNumber} ` +
          `(${queuedCount.toLocaleString()}/${toProcess.toLocaleString()} - ${progress}%)`,
      );
    }

    logger.info('');
    logger.info('━'.repeat(60));
    logger.info(
      `✅ successfully queued ${queuedCount.toLocaleString()} ${targetDesc}`,
    );
    if (capsulesOnly) {
      logger.info(`🛸 ship type: capsule (type_id ${CAPSULE_TYPE_ID})`);
    }
    logger.info('');
    logger.info('🚀 start the worker with:');
    logger.info('   yarn worker:backfill-values');
    logger.info('');
    logger.info(
      '💡 multiple workers can run in parallel for faster processing',
    );
    if (capsulesOnly) {
      logger.info(
        '   each capsule will get 10 ISK ship value + implants value',
      );
    }
    logger.info('━'.repeat(60));

    await channel.close();
    await prismaWorker.$disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('failed to queue backfill values', { error });
    await prismaWorker.$disconnect();
    process.exit(1);
  }
}

queueBackfillValues();
