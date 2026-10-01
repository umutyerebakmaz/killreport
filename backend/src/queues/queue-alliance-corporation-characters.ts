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

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { ensureAllQueuesExist, getRabbitMQChannel } from '@services/rabbitmq';

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
  logger.info('alliance-Corporation character queue script started');
  logger.info('━'.repeat(70));

  try {
    // Fetch all alliances and corporations
    logger.info('fetching data from database...');

    const [alliances, corporations] = await Promise.all([
      prismaWorker.alliance.findMany({
        select: { id: true, name: true, creator_id: true },
        orderBy: { id: 'asc' },
      }),
      prismaWorker.corporation.findMany({
        select: { id: true, name: true, ceo_id: true, creator_id: true },
        orderBy: { id: 'asc' },
      }),
    ]);

    logger.info(`found ${alliances.length} alliances`);
    logger.info(`found ${corporations.length} corporations`);

    // Collect unique character IDs
    const characterIds = new Set<number>();

    // From alliances
    for (const alliance of alliances) {
      if (alliance.creator_id) {
        characterIds.add(alliance.creator_id);
      }
    }

    // From corporations
    for (const corporation of corporations) {
      if (corporation.ceo_id) {
        characterIds.add(corporation.ceo_id);
      }
      if (corporation.creator_id) {
        characterIds.add(corporation.creator_id);
      }
    }

    logger.info(
      `collected ${characterIds.size} unique character IDs (including NPCs)`,
    );
    logger.info('━'.repeat(70));

    // Filter out characters that already exist in database
    logger.info('checking for existing characters in database...');

    const characterIdArray = Array.from(characterIds);
    const existingCharacters = await prismaWorker.character.findMany({
      where: { id: { in: characterIdArray } },
      select: { id: true },
    });

    const existingIds = new Set(existingCharacters.map((c) => c.id));
    const missingCharacterIds = characterIdArray.filter(
      (id) => !existingIds.has(id),
    );

    logger.info(`${existingIds.size} characters already exist`);
    logger.info(`${missingCharacterIds.length} characters need enrichment`);

    if (missingCharacterIds.length === 0) {
      logger.info('━'.repeat(70));
      logger.info('all characters already exist in database!');
      logger.info('━'.repeat(70));
      logger.info('nothing to queue. all done!');
      await prismaWorker.$disconnect();
      process.exit(0);
    }

    logger.info('━'.repeat(70));

    // Connect to RabbitMQ
    await ensureAllQueuesExist();
    const channel = await getRabbitMQChannel();

    logger.info('connected to RabbitMQ');
    logger.info(`queue: ${QUEUE_NAME}`);
    logger.info('adding characters to queue...');

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

        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
          persistent: true,
          priority: 5,
        });

        queuedCount++;
      }

      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(missingCharacterIds.length / BATCH_SIZE);
      logger.info(
        `batch ${batchNum}/${totalBatches}: ${batch.length} characters queued`,
      );
    }

    // Check queue status
    const queueInfo = await channel.checkQueue(QUEUE_NAME);

    logger.info('━'.repeat(70));
    logger.info(`successfully queued ${queuedCount} characters!`);
    logger.info('━'.repeat(70));
    logger.info('statistics:', {
      totalUnique: characterIds.size,
      alreadyInDB: existingIds.size,
      queued: queuedCount,
      totalInQueue: queueInfo.messageCount,
    });
    logger.info('next step: start worker: yarn worker:info:characters');

    await channel.close();
    await prismaWorker.$disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('failed to queue characters', { error });
    await prismaWorker.$disconnect();
    process.exit(1);
  }
}

queueAllianceCorporationCharacters();
