/**
 * Backfill Killmail Values Worker
 *
 * Calculates and updates total_value, destroyed_value, dropped_value for historical killmails
 * Processes killmails from backfill_killmail_values_queue
 *
 * Features:
 * - Batch processing for efficiency
 * - Single market price query for all items
 * - Progress tracking and statistics
 * - Safe upsert to prevent race conditions
 *
 * Usage: yarn worker:backfill-values
 *
 * Run multiple instances in parallel for faster processing:
 *   yarn worker:backfill-values & yarn worker:backfill-values & yarn worker:backfill-values
 */
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getRabbitMQChannel } from '@services/rabbitmq';

const QUEUE_NAME = 'backfill_killmail_values_queue';
const PREFETCH_COUNT = 10; // Process 10 killmails at a time
const STATS_INTERVAL = 50; // Log stats every N processed killmails

// Capsule (pod) type_id - special handling for value calculations
const CAPSULE_TYPE_ID = 670;
const CAPSULE_VALUE = 10;

type BackfillMode = 'null' | 'zero' | 'all';

interface BackfillMessage {
  killmailId: number;
  queuedAt: string;
  source: string;
  mode?: BackfillMode;
}

interface KillmailWithItems {
  killmail_id: number;
  victim: { ship_type_id: number } | null;
  items: Array<{
    item_type_id: number;
    quantity_destroyed: number | null;
    quantity_dropped: number | null;
    singleton: number;
  }>;
}

/**
 * Calculate values for a single killmail
 */
async function calculateValues(killmail: KillmailWithItems) {
  if (!killmail.victim) {
    return { totalValue: 0, destroyedValue: 0, droppedValue: 0 };
  }

  const items = killmail.items || [];

  // Collect all unique type IDs
  const allTypeIds = [
    killmail.victim.ship_type_id,
    ...items.map(item => item.item_type_id)
  ];
  const uniqueTypeIds = [...new Set(allTypeIds)];

  // Fetch all market prices in one query
  const marketPrices = await prismaWorker.marketPrice.findMany({
    where: { type_id: { in: uniqueTypeIds } },
    select: { type_id: true, sell: true }
  });

  // Fetch type info to get group_ids
  const typeInfo = await prismaWorker.type.findMany({
    where: { id: { in: uniqueTypeIds } },
    select: {
      id: true,
      group_id: true
    }
  });

  // Get unique group IDs
  const groupIds = [...new Set(typeInfo.map(t => t.group_id))];

  // Fetch groups
  const groups = await prismaWorker.itemGroup.findMany({
    where: {
      id: { in: groupIds }
    },
    select: {
      id: true,
      category_id: true
    }
  });

  // Get unique category IDs
  const categoryIds = [...new Set(groups.map(g => g.category_id))];

  // Fetch categories
  const categories = await prismaWorker.category.findMany({
    where: {
      id: { in: categoryIds }
    },
    select: {
      id: true,
      name: true
    }
  });

  // Create maps for quick lookup
  const priceMap = new Map(
    marketPrices.map(p => [p.type_id, p.sell || 0])
  );

  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const groupMap = new Map(groups.map(g => [g.id, g]));

  const blueprintMap = new Map(
    typeInfo.map(t => {
      const group = groupMap.get(t.group_id);
      const category = group ? categoryMap.get(group.category_id) : null;
      return [t.id, category?.name?.toLowerCase() === 'blueprint'];
    })
  );

  // Calculate ship value
  // Special case: Capsule (pod) has fixed value of 10 ISK
  const shipPrice = killmail.victim.ship_type_id === CAPSULE_TYPE_ID
    ? CAPSULE_VALUE
    : (priceMap.get(killmail.victim.ship_type_id) || 0);

  let totalValue = shipPrice;
  let destroyedValue = shipPrice;
  let droppedValue = 0;

  // Calculate item values
  for (const item of items) {
    let price = priceMap.get(item.item_type_id) || 0;

    // Blueprint Copy (singleton=2) has no value, only Blueprint Original (singleton=1) has value
    const isBlueprint = blueprintMap.get(item.item_type_id) || false;
    const isBlueprintCopy = isBlueprint && item.singleton === 2;

    if (isBlueprintCopy) {
      price = 0; // Blueprint copies are worthless
    }

    const quantityDestroyed = item.quantity_destroyed || 0;
    const quantityDropped = item.quantity_dropped || 0;

    destroyedValue += price * quantityDestroyed;
    droppedValue += price * quantityDropped;
    totalValue += price * (quantityDestroyed + quantityDropped);
  }

  return {
    totalValue: Math.round(totalValue * 100) / 100,
    destroyedValue: Math.round(destroyedValue * 100) / 100,
    droppedValue: Math.round(droppedValue * 100) / 100
  };
}

async function backfillValuesWorker() {
  logger.info('💰 Backfill Killmail Values Worker Started');
  logger.info(`📦 Queue: ${QUEUE_NAME}`);
  logger.info(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent`);
  logger.info(`📊 Stats interval: Every ${STATS_INTERVAL} killmails\n`);

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let startTime = Date.now();
  let lastMessageTime = Date.now();

  try {
    const channel = await getRabbitMQChannel();

    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: { 'x-max-priority': 10 }
    });

    channel.prefetch(PREFETCH_COUNT);

    logger.info('✅ Connected to RabbitMQ');
    logger.info('⏳ Waiting for killmails...\n');

    // Check if queue is empty periodically
    const emptyCheckInterval = setInterval(async () => {
      const timeSinceLastMessage = Date.now() - lastMessageTime;
      if (timeSinceLastMessage > 5000 && totalProcessed > 0) {
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const rate = totalProcessed / elapsedSeconds;

        logger.info('\n' + '━'.repeat(60));
        logger.info('✅ Queue completed!');
        logger.info(`📊 Total: ${totalProcessed.toLocaleString()} processed`);
        logger.info(`   ✓ Updated: ${totalUpdated.toLocaleString()}`);
        logger.info(`   - Skipped: ${totalSkipped.toLocaleString()}`);
        logger.info(`   ✗ Errors: ${totalErrors.toLocaleString()}`);
        logger.info(`⏱️  Rate: ${rate.toFixed(2)} killmails/sec`);
        logger.info(`🕐 Time: ${Math.floor(elapsedSeconds / 60)}m ${Math.floor(elapsedSeconds % 60)}s`);
        logger.info('━'.repeat(60) + '\n');
        logger.info('⏳ Waiting for new messages...\n');
      }
    }, 5000);

    channel.consume(QUEUE_NAME, async (msg) => {
      if (msg) lastMessageTime = Date.now();
      if (!msg) return;

      const message: BackfillMessage = JSON.parse(msg.content.toString());
      const killmailId = message.killmailId;

      try {
        const mode: BackfillMode = message.mode || 'null';

        // Check if already has values (race condition protection)
        const existing = await prismaWorker.killmail.findUnique({
          where: { killmail_id: killmailId },
          select: { total_value: true }
        });

        // Decide whether to skip based on mode
        let shouldSkip = false;
        if (mode === 'null') {
          // Skip if value is not null (already calculated)
          shouldSkip = existing?.total_value !== null && existing?.total_value !== undefined;
        } else if (mode === 'zero') {
          // Skip if value is not 0 (already calculated and non-zero)
          shouldSkip = existing?.total_value !== 0;
        } else if (mode === 'all') {
          // Never skip, always recalculate
          shouldSkip = false;
        }

        if (shouldSkip) {
          totalSkipped++;
          totalProcessed++;
          channel.ack(msg);

          if (totalProcessed % STATS_INTERVAL === 0) {
            const rate = totalProcessed / ((Date.now() - startTime) / 1000);
            logger.info(
              `📊 [${totalProcessed}] Rate: ${rate.toFixed(2)}/sec | ` +
              `Updated: ${totalUpdated} | Skipped: ${totalSkipped} | Errors: ${totalErrors}`
            );
          }
          return;
        }

        // Fetch killmail with items
        const killmail = await prismaWorker.killmail.findUnique({
          where: { killmail_id: killmailId },
          include: {
            victim: { select: { ship_type_id: true } },
            items: {
              select: {
                item_type_id: true,
                quantity_destroyed: true,
                quantity_dropped: true,
                singleton: true
              }
            }
          }
        });

        if (!killmail) {
          logger.warn(`⚠️  [${totalProcessed + 1}] Killmail ${killmailId} not found`);
          totalSkipped++;
          totalProcessed++;
          channel.ack(msg);
          return;
        }

        // Calculate values
        const values = await calculateValues(killmail);

        // Update killmail
        await prismaWorker.killmail.update({
          where: { killmail_id: killmailId },
          data: {
            total_value: values.totalValue,
            destroyed_value: values.destroyedValue,
            dropped_value: values.droppedValue
          }
        });

        totalUpdated++;
        totalProcessed++;
        channel.ack(msg);

        // Log progress
        if (totalProcessed % STATS_INTERVAL === 0) {
          const rate = totalProcessed / ((Date.now() - startTime) / 1000);
          logger.info(
            `📊 [${totalProcessed}] Rate: ${rate.toFixed(2)}/sec | ` +
            `Updated: ${totalUpdated} | Skipped: ${totalSkipped} | Errors: ${totalErrors}`
          );
        }

      } catch (error: any) {
        totalErrors++;
        totalProcessed++;
        logger.error(`❌ [${totalProcessed}] Killmail ${killmailId} failed:`, error.message);
        channel.ack(msg); // Ack to avoid reprocessing
      }
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('\n🛑 Shutting down gracefully...');
      clearInterval(emptyCheckInterval);
      await channel.close();
      await prismaWorker.$disconnect();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Worker failed to start', { error });
    await prismaWorker.$disconnect();
    process.exit(1);
  }
}

backfillValuesWorker();
