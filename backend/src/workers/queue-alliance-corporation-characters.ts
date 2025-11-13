/**
 * Queue Alliance-Corporation Characters Script
 * Collects character IDs from alliances and corporations tables and queues them for enrichment
 *
 * Character IDs collected from:
 * - Alliance.creator_id
 * - Corporation.ceo_id
 * - Corporation.creator_id
 *
 * Usage: yarn queue:alliance-corp-characters
 */

import '../config';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_character_info_queue';
const BATCH_SIZE = 100;

interface EntityQueueMessage {
  entityId: number;
  queuedAt: string;
  source: string;
}

/**
 * Check if entity is NPC character
 */
function isNPCCharacter(id: number): boolean {
  return id < 1000000 || (id >= 3000000 && id < 4000000);
}

/**
 * Collects character IDs from alliances and corporations and queues them
 */
async function queueAllianceCorporationCharacters() {
  console.log('🤝 Alliance-Corporation Character Queue Script Started\n');
  console.log('━'.repeat(70));

  try {
    // Fetch all alliances and corporations
    console.log('📊 Fetching data from database...');

    const [alliances, corporations] = await Promise.all([
      prisma.alliance.findMany({
        select: { id: true, name: true, creator_id: true },
        orderBy: { id: 'asc' },
      }),
      prisma.corporation.findMany({
        select: { id: true, name: true, ceo_id: true, creator_id: true },
        orderBy: { id: 'asc' },
      }),
    ]);

    console.log(`✅ Found ${alliances.length} alliances`);
    console.log(`✅ Found ${corporations.length} corporations\n`);

    // Collect unique character IDs
    const characterIds = new Set<number>();

    // From alliances
    for (const alliance of alliances) {
      if (alliance.creator_id && !isNPCCharacter(alliance.creator_id)) {
        characterIds.add(alliance.creator_id);
      }
    }

    // From corporations
    for (const corporation of corporations) {
      if (corporation.ceo_id && !isNPCCharacter(corporation.ceo_id)) {
        characterIds.add(corporation.ceo_id);
      }
      if (corporation.creator_id && !isNPCCharacter(corporation.creator_id)) {
        characterIds.add(corporation.creator_id);
      }
    }

    console.log(`✅ Collected ${characterIds.size} unique character IDs (NPCs filtered)\n`);
    console.log('━'.repeat(70));

    // Filter out characters that already exist in database
    console.log('🔍 Checking for existing characters in database...');

    const characterIdArray = Array.from(characterIds);
    const existingCharacters = await prisma.character.findMany({
      where: { id: { in: characterIdArray } },
      select: { id: true },
    });

    const existingIds = new Set(existingCharacters.map(c => c.id));
    const missingCharacterIds = characterIdArray.filter(id => !existingIds.has(id));

    console.log(`✅ ${existingIds.size} characters already exist`);
    console.log(`✅ ${missingCharacterIds.length} characters need enrichment\n`);

    if (missingCharacterIds.length === 0) {
      console.log('━'.repeat(70));
      console.log('✅ All characters already exist in database!');
      console.log('━'.repeat(70));
      console.log('\n💡 Nothing to queue. All done!\n');
      await prisma.$disconnect();
      process.exit(0);
    }

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
    console.log('📤 Adding characters to queue...\n');

    // Add to queue in batches
    let queuedCount = 0;
    for (let i = 0; i < missingCharacterIds.length; i += BATCH_SIZE) {
      const batch = missingCharacterIds.slice(i, i + BATCH_SIZE);

      for (const characterId of batch) {
        const message: EntityQueueMessage = {
          entityId: characterId,
          queuedAt: new Date().toISOString(),
          source: 'alliance_corporation_characters',
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
      const totalBatches = Math.ceil(missingCharacterIds.length / BATCH_SIZE);
      console.log(
        `  ✅ Batch ${batchNum}/${totalBatches}: ${batch.length} characters queued`
      );
    }

    // Check queue status
    const queueInfo = await channel.checkQueue(QUEUE_NAME);

    console.log('\n' + '━'.repeat(70));
    console.log(`✅ Successfully queued ${queuedCount} characters!`);
    console.log('━'.repeat(70));
    console.log('\n💡 Statistics:');
    console.log(`   📊 Total unique IDs collected: ${characterIds.size}`);
    console.log(`   ✅ Already in database: ${existingIds.size}`);
    console.log(`   📤 Queued for enrichment: ${queuedCount}`);
    console.log(`   📦 Total messages in queue: ${queueInfo.messageCount}`);
    console.log('\n💡 Next Step:');
    console.log('   Start worker: yarn worker:info:characters\n');

    await channel.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to queue characters:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

queueAllianceCorporationCharacters();
