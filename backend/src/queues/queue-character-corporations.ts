import '../config';
import logger from '../services/logger';
import prismaWorker from '../services/prisma-worker';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_corporation_info_queue';
const BATCH_SIZE = 100;

/**
 * Scans all characters in database and queues missing corporations
 * These will be processed by worker:info:corporations to fetch from ESI
 */
async function queueCharacterCorporations() {
  logger.info('Scanning characters for missing corporations...');

  try {
    // Get all unique corporation_ids from characters
    const allCharacters = await prismaWorker.character.findMany({
      select: { corporation_id: true },
      distinct: ['corporation_id'],
    });

    const corporationIdsFromCharacters = allCharacters
      .map((c) => c.corporation_id)
      .filter((id): id is number => id !== null && id !== undefined);

    logger.info(`Found ${corporationIdsFromCharacters.length} unique corporations from characters`);

    // Get existing corporation IDs from database
    const existingCorporations = await prismaWorker.corporation.findMany({
      select: { id: true },
    });

    const existingCorporationIds = new Set(existingCorporations.map((c) => c.id));

    // Find missing corporations
    const missingCorporationIds = corporationIdsFromCharacters.filter(
      (id) => !existingCorporationIds.has(id)
    );

    logger.info(`Found ${missingCorporationIds.length} missing corporations`);

    if (missingCorporationIds.length === 0) {
      logger.info('✅ No missing corporations to queue!');
      process.exit(0);
    }

    logger.info(`Adding to queue: ${QUEUE_NAME}`);

    const channel = await getRabbitMQChannel();

    // Ensure queue exists
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: { 'x-max-priority': 10 },
    });

    // Add to queue in batches with proper message format
    let queuedCount = 0;
    for (let i = 0; i < missingCorporationIds.length; i += BATCH_SIZE) {
      const batch = missingCorporationIds.slice(i, i + BATCH_SIZE);

      for (const id of batch) {
        const message = {
          entityId: id,
          queuedAt: new Date().toISOString(),
          source: 'queue-character-corporations',
        };
        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
          persistent: true,
        });
        queuedCount++;
      }

      logger.info(
        `Queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
          missingCorporationIds.length / BATCH_SIZE
        )} (${batch.length} corporations)`
      );
    }

    logger.info(`✅ All ${queuedCount} missing corporations queued successfully!`);
    logger.info('Now run the worker: yarn worker:info:corporations');

    await channel.close();
    process.exit(0);
  } catch (error) {
    logger.error('Failed to queue character corporations', { error });
    process.exit(1);
  }
}

queueCharacterCorporations();
