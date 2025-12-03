/**
 * Queue Alliance Corporations Script
 * Fetches all alliance IDs from database and adds them to alliance_corporation_queue
 *
 * Usage: yarn queue:alliance-corporations
 */

import '../config';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_alliance_corporations_queue';
const BATCH_SIZE = 100;

interface EntityQueueMessage {
  entityId: number;
  queuedAt: string;
  source: string;
}

/**
 * Fetches all alliance IDs from database and adds them to RabbitMQ queue
 */
async function queueAllianceCorporations() {
  console.log('🤝 Alliance Corporation Queue Script Started\n');
  console.log('━'.repeat(70));

  try {
    // Get all alliance IDs from database
    console.log('📊 Fetching alliance IDs from database...');
    const alliances = await prisma.alliance.findMany({
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    });

    if (alliances.length === 0) {
      console.log('\n⚠️  No alliances found in database');
      console.log('💡 Run yarn queue:alliances and yarn worker:info:alliances first\n');
      process.exit(0);
    }

    console.log(`✅ Found ${alliances.length} alliances in database\n`);
    console.log('━'.repeat(70));

    // Connect to RabbitMQ
    const channel = await getRabbitMQChannel();

    // Assert queue exists
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: { 'x-max-priority': 10 },
    });

    console.log(`✅ Connected to RabbitMQ`);
    console.log(`📦 Queue: ${QUEUE_NAME}\n`);
    console.log('📤 Adding alliances to queue...\n');

    // Add to queue in batches
    let queuedCount = 0;
    for (let i = 0; i < alliances.length; i += BATCH_SIZE) {
      const batch = alliances.slice(i, i + BATCH_SIZE);

      for (const alliance of batch) {
        const message: EntityQueueMessage = {
          entityId: alliance.id,
          queuedAt: new Date().toISOString(),
          source: 'esi_alliance_corporations_queue',
        };

        channel.sendToQueue(
          QUEUE_NAME,
          Buffer.from(JSON.stringify(message)),
          {
            persistent: true,
            priority: 5,
          }
        );

        queuedCount++;
      }

      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(alliances.length / BATCH_SIZE);
      console.log(
        `  ⏳ Batch ${batchNum}/${totalBatches}: ${batch.length} alliances queued`
      );
    }

    console.log('\n' + '━'.repeat(70));
    console.log(`✅ Successfully queued ${queuedCount} alliances!`);
    console.log('━'.repeat(70));
    console.log('\n💡 Next Steps:');
    console.log('   1. Start worker: yarn worker:alliance-corporations');
    console.log('   2. Start enrichment: yarn worker:info:corporations\n');

    await channel.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to queue alliance corporations:', error);
    process.exit(1);
  }
}

queueAllianceCorporations();
