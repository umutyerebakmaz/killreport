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
import { calculateKillmailValues } from '@helpers/calculate-killmail-values';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getRabbitMQChannel } from '@services/rabbitmq';

const QUEUE_NAME = 'backfill_killmail_values_queue';
const PREFETCH_COUNT = 10; // Process 10 killmails at a time
const STATS_INTERVAL = 50; // Log stats every N processed killmails

interface BackfillMessage {
  killmailId: number;
  queuedAt: string;
  source: string;
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

      // Validate killmailId
      if (!killmailId || typeof killmailId !== 'number') {
        logger.warn(`⚠️  Invalid killmailId in message: ${JSON.stringify(message)}`);
        totalErrors++;
        totalProcessed++;
        channel.ack(msg); // Remove invalid message
        return;
      }

      try {
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

        if (!killmail.victim) {
          logger.warn(`⚠️  [${totalProcessed + 1}] Killmail ${killmailId} has no victim`);
          totalSkipped++;
          totalProcessed++;
          channel.ack(msg);
          return;
        }

        // Calculate values using the shared helper function (includes BPO/BPC handling)
        const values = await calculateKillmailValues({
          victim: killmail.victim,
          items: killmail.items.map(item => ({
            item_type_id: item.item_type_id,
            quantity_destroyed: item.quantity_destroyed ?? undefined,
            quantity_dropped: item.quantity_dropped ?? undefined,
            singleton: item.singleton
          }))
        });

        // Log calculated values for debugging
        if (totalProcessed % 10 === 0) {
          logger.info(`💰 [${totalProcessed + 1}] KM ${killmailId}: Total=${values.totalValue.toFixed(2)}, Destroyed=${values.destroyedValue.toFixed(2)}, Dropped=${values.droppedValue.toFixed(2)}`);
        }

        // Skip update if all values are zero (no market data)
        if (values.totalValue === 0 && values.destroyedValue === 0 && values.droppedValue === 0) {
          logger.warn(`⚠️  [${totalProcessed + 1}] Killmail ${killmailId} has zero values - skipping update`);
          totalSkipped++;
          totalProcessed++;
          channel.ack(msg);
          return;
        }

        // Update killmail
        const updated = await prismaWorker.killmail.update({
          where: { killmail_id: killmailId },
          data: {
            total_value: values.totalValue,
            destroyed_value: values.destroyedValue,
            dropped_value: values.droppedValue
          }
        });

        // Verify the update
        if (updated.total_value !== values.totalValue) {
          logger.error(`❌ [${totalProcessed + 1}] Killmail ${killmailId} update FAILED! Expected ${values.totalValue}, got ${updated.total_value}`);
          totalErrors++;
        } else {
          totalUpdated++;
        }

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
