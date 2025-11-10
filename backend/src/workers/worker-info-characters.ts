/**
 * Character Info Worker
 * Fetches character information from ESI and saves to database
 */

import '../config';
import { getCharacterInfo } from '../services/eve-esi';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_character_info_queue';
const PREFETCH_COUNT = 10; // Process 10 characters concurrently

interface EntityQueueMessage {
  entityId: number;
  queuedAt: string;
  source: string;
}

async function characterInfoWorker() {
  console.log('👤 Character Info Worker Started');
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
    console.log('⏳ Waiting for characters...\n');

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
        const characterId = message.entityId;

        try {

          // Check if already exists
          const existing = await prisma.character.findUnique({
            where: { id: characterId },
          });

          if (existing) {
            channel.ack(msg);
            totalSkipped++;
            totalProcessed++;
            console.log(`  - [${totalProcessed}] Character ${characterId} (exists)`);
            return;
          }          // Fetch from ESI
          const charInfo = await getCharacterInfo(characterId);

          // Save to database (upsert to prevent race condition)
          await prisma.character.upsert({
            where: { id: characterId },
            create: {
              id: characterId,
              name: charInfo.name,
              corporation_id: charInfo.corporation_id,
              alliance_id: charInfo.alliance_id,
              birthday: new Date(charInfo.birthday),
              bloodline_id: charInfo.bloodline_id,
              race_id: charInfo.race_id,
              gender: charInfo.gender,
              security_status: charInfo.security_status,
              description: charInfo.description,
              title: charInfo.title,
              faction_id: charInfo.faction_id,
            },
            update: {}, // Don't update if exists
          });

          totalAdded++;
          channel.ack(msg);
          totalProcessed++;
          console.log(`  ✓ [${totalProcessed}] ${charInfo.name}`);

          if (totalProcessed % 50 === 0) {
            console.log(`📊 Summary: ${totalProcessed} processed (${totalAdded} added, ${totalSkipped} skipped, ${totalErrors} errors)`);
          }

        } catch (error: any) {
          totalErrors++;
          totalProcessed++;

          // 404 = deleted character, don't requeue
          if (error.message?.includes('404')) {
            console.log(`  ! [${totalProcessed}] Character ${message.entityId} (404)`);
            channel.ack(msg);
          } else {
            // Other errors: requeue
            console.error(`  × [${totalProcessed}] Character ${message.entityId}: ${error.message}`);
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
characterInfoWorker();
