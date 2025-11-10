/**
 * Alliance Corporation Worker
 * Fetches corporation IDs from ESI for each alliance and queues them for enrichment
 *
 * Workflow:
 * 1. Consumes alliance IDs from alliance_corporation_queue
 * 2. Fetches corporation IDs from ESI (/alliances/{alliance_id}/corporations/)
 * 3. Queues each corporation ID to corporation_enrichment_queue
 * 4. worker-enrichment-corporations.ts then processes these IDs
 *
 * Usage: yarn worker:alliance-corporations
 */

import '../config';
import { getAllianceCorporations } from '../services/eve-esi';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_alliance_corporations_queue';
const CORPORATION_QUEUE = 'esi_corporation_enrichment_queue';
const PREFETCH_COUNT = 5; // Process 5 alliances concurrently

interface EntityQueueMessage {
  entityId: number;
  queuedAt: string;
  source: string;
}

async function allianceCorporationWorker() {
  console.log('🤝 Alliance Corporation Worker Started');
  console.log(`📦 Input Queue: ${QUEUE_NAME}`);
  console.log(`📦 Output Queue: ${CORPORATION_QUEUE}`);
  console.log(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent\n`);

  try {
    const channel = await getRabbitMQChannel();

    // Assert both queues exist
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: { 'x-max-priority': 10 },
    });

    await channel.assertQueue(CORPORATION_QUEUE, {
      durable: true,
      arguments: { 'x-max-priority': 10 },
    });

    channel.prefetch(PREFETCH_COUNT);

    console.log('✅ Connected to RabbitMQ');
    console.log('⏳ Waiting for alliances...\n');

    let totalProcessed = 0;
    let totalCorporationsQueued = 0;
    let totalErrors = 0;
    let lastMessageTime = Date.now();

    // Check if queue is empty every 5 seconds
    const emptyCheckInterval = setInterval(async () => {
      const timeSinceLastMessage = Date.now() - lastMessageTime;
      if (timeSinceLastMessage > 5000 && totalProcessed > 0) {
        console.log('\n' + '━'.repeat(60));
        console.log('✅ Queue completed!');
        console.log(
          `📊 Final: ${totalProcessed} alliances processed, ${totalCorporationsQueued} corporations queued, ${totalErrors} errors`
        );
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
        const allianceId = message.entityId;

        try {
          // Get alliance name for logging
          const alliance = await prisma.alliance.findUnique({
            where: { id: allianceId },
            select: { name: true },
          });

          const allianceName = alliance?.name || `Unknown_${allianceId}`;

          // Fetch corporation IDs from ESI
          const corporationIds = await getAllianceCorporations(allianceId);

          if (corporationIds.length === 0) {
            console.log(
              `  ⚠️  [${totalProcessed + 1}] ${allianceName} (${allianceId}) - No corporations found`
            );
            channel.ack(msg);
            totalProcessed++;
            return;
          }

          // Queue each corporation ID for enrichment
          let queuedCount = 0;
          for (const corpId of corporationIds) {
            const corpMessage: EntityQueueMessage = {
              entityId: corpId,
              queuedAt: new Date().toISOString(),
              source: `alliance_${allianceId}`,
            };

            channel.sendToQueue(
              CORPORATION_QUEUE,
              Buffer.from(JSON.stringify(corpMessage)),
              {
                persistent: true,
                priority: 3, // Lower priority than direct enrichment requests
              }
            );

            queuedCount++;
          }

          totalCorporationsQueued += queuedCount;
          totalProcessed++;

          console.log(
            `  ✅ [${totalProcessed}] ${allianceName} (${allianceId}) - Queued ${queuedCount} corporations`
          );

          channel.ack(msg);
        } catch (error) {
          totalErrors++;
          totalProcessed++;

          console.error(
            `  ❌ [${totalProcessed}] Alliance ${allianceId} - Error:`,
            error instanceof Error ? error.message : error
          );

          // Nack and requeue for retry
          channel.nack(msg, false, true);
        }
      },
      { noAck: false }
    );

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n⚠️  Received SIGINT, shutting down gracefully...');
      clearInterval(emptyCheckInterval);
      console.log('\n' + '━'.repeat(60));
      console.log('📊 Final Statistics:');
      console.log(`   Alliances processed: ${totalProcessed}`);
      console.log(`   Corporations queued: ${totalCorporationsQueued}`);
      console.log(`   Errors: ${totalErrors}`);
      console.log('━'.repeat(60) + '\n');
      process.exit(0);
    });
  } catch (error) {
    console.error('💥 Worker failed to start:', error);
    process.exit(1);
  }
}

allianceCorporationWorker();
