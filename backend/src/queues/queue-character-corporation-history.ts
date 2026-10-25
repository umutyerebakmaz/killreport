import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { ensureAllQueuesExist, getRabbitMQChannel } from '@services/rabbitmq';

const QUEUE_NAME = 'esi_character_corporation_history_queue';
const BATCH_SIZE = 100;

/**
 * Queues characters whose corporation history needs fetching from ESI
 * Usage:
 *   yarn queue:character-corporation-history              # Queue every stale character
 *   yarn queue:character-corporation-history 123 456 789  # Queue specific character IDs
 *
 * Stale means never fetched, or last fetched more than 6 days ago. The
 * threshold is shorter than the weekly schedule on purpose: at exactly 7 days,
 * a character fetched after the previous run started would still be a little
 * under 7 days old and be skipped, so it would refresh every two weeks.
 */
async function queueCharacterCorporationHistory() {
  try {
    const args = process.argv.slice(2);
    let characterIds: number[] = [];

    if (args.length > 0) {
      characterIds = args
        .map((arg) => parseInt(arg, 10))
        .filter((id) => !isNaN(id));

      if (characterIds.length === 0) {
        logger.error('invalid character IDs provided');
        process.exit(1);
      }

      logger.info(
        `queueing ${characterIds.length} specific character(s): ${characterIds.join(', ')}`,
      );
    } else {
      logger.info('fetching stale character IDs from database...');
      const rows = await prismaWorker.$queryRaw<{ id: number }[]>`
        SELECT c.id FROM characters c
        LEFT JOIN (
          SELECT character_id, MAX(fetched_at) AS fetched_at
          FROM character_corporation_history
          GROUP BY character_id
        ) h ON h.character_id = c.id
        -- fetched_at is a UTC timestamp without time zone
        WHERE h.fetched_at IS NULL
           OR h.fetched_at < (NOW() AT TIME ZONE 'UTC') - INTERVAL '6 days'
        ORDER BY c.id
      `;
      characterIds = rows.map((r) => r.id);
      logger.info(`found ${characterIds.length} stale characters`);
    }

    logger.info(`adding to queue: ${QUEUE_NAME}`);

    await ensureAllQueuesExist();
    const channel = await getRabbitMQChannel();

    let queuedCount = 0;
    for (let i = 0; i < characterIds.length; i += BATCH_SIZE) {
      const batch = characterIds.slice(i, i + BATCH_SIZE);

      for (const id of batch) {
        const message = {
          entityId: id,
          queuedAt: new Date().toISOString(),
          source: 'queue-character-corporation-history',
        };
        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
          persistent: true,
        });
        queuedCount++;
      }

      if (characterIds.length > 100) {
        logger.debug(
          `queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
            characterIds.length / BATCH_SIZE,
          )} (${batch.length} characters)`,
        );
      }
    }

    logger.info(`✅ all ${queuedCount} character(s) queued successfully!`);
    logger.info(
      'now run the worker: yarn worker:character-corporation-history',
    );

    await channel.close();
    process.exit(0);
  } catch (error) {
    logger.error('failed to queue character corporation history', { error });
    process.exit(1);
  }
}

queueCharacterCorporationHistory();
