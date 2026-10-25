import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { ensureAllQueuesExist, getRabbitMQChannel } from '@services/rabbitmq';

const QUEUE_NAME = 'esi_corporation_info_queue';
const BATCH_SIZE = 100;

/**
 * Queues every corporation a character points at that is not in the database
 * yet: a character's current corporation, and every corporation in its
 * employment history. worker:info:corporations then fetches them from ESI.
 *
 * worker-character-corporation-history queues a history's missing
 * corporations as soon as it saves them, but RabbitMQ is not the record of
 * outstanding work; this daily scan is what catches a message that was lost.
 */
async function queueCharacterCorporations() {
  logger.info(
    'scanning characters and their corporation history for missing corporations...',
  );

  try {
    // UNION already de-duplicates; the anti-join leaves only the unknown ones
    const rows = await prismaWorker.$queryRaw<{ corporation_id: number }[]>`
      SELECT ids.corporation_id
      FROM (
        SELECT corporation_id FROM characters
        UNION
        SELECT corporation_id FROM character_corporation_history
      ) ids
      WHERE NOT EXISTS (
        SELECT 1 FROM corporations c WHERE c.id = ids.corporation_id
      )
      ORDER BY ids.corporation_id
    `;
    const missingCorporationIds = rows.map((r) => r.corporation_id);

    logger.info(`found ${missingCorporationIds.length} missing corporations`);

    if (missingCorporationIds.length === 0) {
      logger.info('✅ no missing corporations to queue!');
      process.exit(0);
    }

    logger.info(`adding to queue: ${QUEUE_NAME}`);

    await ensureAllQueuesExist();
    const channel = await getRabbitMQChannel();

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
        `queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
          missingCorporationIds.length / BATCH_SIZE,
        )} (${batch.length} corporations)`,
      );
    }

    logger.info(
      `✅ all ${queuedCount} missing corporations queued successfully!`,
    );
    logger.info('now run the worker: yarn worker:info:corporations');

    await channel.close();
    process.exit(0);
  } catch (error) {
    logger.error('failed to queue character corporations', { error });
    process.exit(1);
  }
}

queueCharacterCorporations();
