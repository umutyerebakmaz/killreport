import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { ensureAllQueuesExist } from '@services/rabbitmq';
import { publishEntitiesConfirmed } from './publish-entities';

const QUEUE_NAME = 'esi_character_corporation_history_queue';

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
    // Resolves only once the broker has confirmed every message, so the
    // process.exit below can no longer drop what it had not taken yet.
    const queuedCount = await publishEntitiesConfirmed(
      QUEUE_NAME,
      'queue-character-corporation-history',
      characterIds,
      {
        onBatch: (batch, total, size) => {
          if (characterIds.length > 100) {
            logger.debug(`queued batch ${batch}/${total} (${size} characters)`);
          }
        },
      },
    );

    logger.info(`✅ all ${queuedCount} character(s) queued successfully!`);
    logger.info(
      'now run the worker: yarn worker:character-corporation-history',
    );

    process.exit(0);
  } catch (error) {
    logger.error('failed to queue character corporation history', { error });
    process.exit(1);
  }
}

queueCharacterCorporationHistory();
