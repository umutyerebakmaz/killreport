/**
 * Corporation Info Worker
 * Fetches corporation information from ESI and saves to database
 */

import '../config';
import { getCorporationInfo } from '../services/eve-esi';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_corporation_info_queue';
const PREFETCH_COUNT = 5; // Process 5 corporations concurrently

interface EntityQueueMessage {
  entityId: number;
  queuedAt: string;
  source: string;
}

async function corporationInfoWorker() {
  console.log('🏢 Corporation Info Worker Started');
  console.log(`📦 Queue: ${QUEUE_NAME}`);
  console.log(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent\n`);

  try {
    const channel = await getRabbitMQChannel();

    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: { 'x-max-priority': 10 },
    });

    channel.prefetch(PREFETCH_COUNT);

    console.log('✅ Connected to RabbitMQ');
    console.log('⏳ Waiting for corporations...\n');

    let totalProcessed = 0;
    let totalAdded = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let lastMessageTime = Date.now();

    // Check if queue is empty every 5 seconds
    const emptyCheckInterval = setInterval(async () => {
      const timeSinceLastMessage = Date.now() - lastMessageTime;
      if (timeSinceLastMessage > 5000 && totalProcessed > 0) {
        console.log('\n' + '━'.repeat(60));
        console.log('✅ Queue completed!');
        console.log(`📊 Final: ${totalProcessed} processed (${totalAdded} added, ${totalSkipped} skipped, ${totalErrors} errors)`);
        console.log('━'.repeat(60) + '\n');
        console.log('⏳ Waiting for new messages...\n');
      }
    }, 5000);

    channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (msg) lastMessageTime = Date.now();
        if (!msg) return;

        const message: EntityQueueMessage = JSON.parse(msg.content.toString());
        const corporationId = message.entityId;

        try {

          // Check if already exists
          const existing = await prisma.corporation.findUnique({
            where: { id: corporationId },
          });

          if (existing) {
            channel.ack(msg);
            totalSkipped++;
            totalProcessed++;
            console.log(`  - [${totalProcessed}] Corporation ${corporationId} (exists)`);
            return;
          }          // Fetch from ESI
          const corpInfo = await getCorporationInfo(corporationId);

          // Save to database (upsert to prevent race condition)
          await prisma.corporation.upsert({
            where: { id: corporationId },
            create: {
              id: corporationId,
              name: corpInfo.name,
              ticker: corpInfo.ticker,
              member_count: corpInfo.member_count,
              ceo_id: corpInfo.ceo_id,
              creator_id: corpInfo.creator_id,
              date_founded: corpInfo.date_founded ? new Date(corpInfo.date_founded) : null,
              description: corpInfo.description,
              alliance_id: corpInfo.alliance_id,
              faction_id: corpInfo.faction_id,
              home_station_id: corpInfo.home_station_id,
              shares: corpInfo.shares,
              tax_rate: corpInfo.tax_rate,
              url: corpInfo.url,
            },
            update: {}, // Don't update if exists
          });

          totalAdded++;
          channel.ack(msg);
          totalProcessed++;
          console.log(`  ✓ [${totalProcessed}] ${corpInfo.name} [${corpInfo.ticker}]`);

          if (totalProcessed % 50 === 0) {
            console.log(`📊 Summary: ${totalProcessed} processed (${totalAdded} added, ${totalSkipped} skipped, ${totalErrors} errors)`);
          }

        } catch (error: any) {
          totalErrors++;
          totalProcessed++;

          if (error.message?.includes('404')) {
            console.log(`  ! [${totalProcessed}] Corporation ${message.entityId} (404)`);
            channel.ack(msg);
          } else {
            console.error(`  × [${totalProcessed}] Corporation ${message.entityId}: ${error.message}`);
            channel.nack(msg, false, true);
          }

          if (totalProcessed % 50 === 0) {
            console.log(`📊 Summary: ${totalProcessed} processed (${totalAdded} added, ${totalSkipped} skipped, ${totalErrors} errors)`);
          }
        }
      },
      { noAck: false }
    );

  } catch (error) {
    console.error('💥 Worker failed to start:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

function setupShutdownHandlers() {
  const shutdown = async () => {
    console.log('\n\n⚠️  Shutting down...');
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

setupShutdownHandlers();
corporationInfoWorker();
