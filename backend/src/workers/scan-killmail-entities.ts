/**
 * Killmail Entity Scanner
 *
 * Queues every character, corporation, alliance and type a killmail names
 * that is not in the database yet, onto the queue of the info worker that
 * fetches it from ESI. Each domain is one SQL anti-join over victims,
 * attackers and killmail items; nothing is loaded into memory. NPCs are not
 * filtered out: ESI resolves them and killmail pages show their names.
 *
 * The Rust counterpart is `yarn scan:entities:rs`, a chain of the four
 * `queue-killmail-*` binaries running the same SQL.
 */

import { Prisma } from '@generated/prisma/client';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { ensureAllQueuesExist } from '@services/rabbitmq';
import { publishEntitiesConfirmed } from '../queues/publish-entities';

const SOURCE = 'killmail_scan';
const PRIORITY = 5;

interface Domain {
  label: string;
  queue: string;
  worker: string;
  sql: Prisma.Sql;
}

// The UNION de-duplicates, the anti-join leaves only the unknown ones.
const DOMAINS: Domain[] = [
  {
    label: 'characters',
    queue: 'esi_character_info_queue',
    worker: 'yarn worker:info:characters',
    sql: Prisma.sql`
      SELECT ids.id
      FROM (
        SELECT character_id AS id FROM victims WHERE character_id IS NOT NULL
        UNION
        SELECT character_id FROM attackers WHERE character_id IS NOT NULL
      ) ids
      WHERE NOT EXISTS (SELECT 1 FROM characters c WHERE c.id = ids.id)
      ORDER BY ids.id
    `,
  },
  {
    label: 'corporations',
    queue: 'esi_corporation_info_queue',
    worker: 'yarn worker:info:corporations',
    sql: Prisma.sql`
      SELECT ids.id
      FROM (
        SELECT corporation_id AS id FROM victims WHERE corporation_id IS NOT NULL
        UNION
        SELECT corporation_id FROM attackers WHERE corporation_id IS NOT NULL
      ) ids
      WHERE NOT EXISTS (SELECT 1 FROM corporations c WHERE c.id = ids.id)
      ORDER BY ids.id
    `,
  },
  {
    label: 'alliances',
    queue: 'esi_alliance_info_queue',
    worker: 'yarn worker:info:alliances',
    sql: Prisma.sql`
      SELECT ids.id
      FROM (
        SELECT alliance_id AS id FROM victims WHERE alliance_id IS NOT NULL
        UNION
        SELECT alliance_id FROM attackers WHERE alliance_id IS NOT NULL
      ) ids
      WHERE NOT EXISTS (SELECT 1 FROM alliances a WHERE a.id = ids.id)
      ORDER BY ids.id
    `,
  },
  {
    label: 'types',
    queue: 'esi_type_info_queue',
    worker: 'yarn worker:info:types',
    sql: Prisma.sql`
      SELECT ids.id
      FROM (
        SELECT ship_type_id AS id FROM victims WHERE ship_type_id IS NOT NULL
        UNION
        SELECT ship_type_id FROM attackers WHERE ship_type_id IS NOT NULL
        UNION
        SELECT weapon_type_id FROM attackers WHERE weapon_type_id IS NOT NULL
        UNION
        SELECT item_type_id FROM killmail_items WHERE item_type_id IS NOT NULL
      ) ids
      WHERE NOT EXISTS (SELECT 1 FROM types t WHERE t.id = ids.id)
      ORDER BY ids.id
    `,
  },
];

async function scanAndQueueEntities() {
  logger.info('🔍 killmail entity scanner started');

  try {
    let queuesReady = false;
    const workersToRun: string[] = [];

    for (const domain of DOMAINS) {
      logger.info(`scanning killmails for missing ${domain.label}...`);
      const rows = await prismaWorker.$queryRaw<{ id: number }[]>(domain.sql);
      const ids = rows.map((r) => r.id);
      logger.info(`found ${ids.length} missing ${domain.label}`);

      if (ids.length === 0) {
        logger.info(`✅ no missing ${domain.label} to queue!`);
        continue;
      }

      if (!queuesReady) {
        await ensureAllQueuesExist();
        queuesReady = true;
      }

      logger.info(`adding to queue: ${domain.queue}`);
      // Resolves only once the broker has confirmed every message, so the
      // process.exit below can no longer drop what it had not taken yet.
      const queued = await publishEntitiesConfirmed(domain.queue, SOURCE, ids, {
        priority: PRIORITY,
        onBatch: (batch, total, size) =>
          logger.debug(
            `queued batch ${batch}/${total} (${size} ${domain.label})`,
          ),
      });
      logger.info(
        `✅ all ${queued} missing ${domain.label} queued successfully!`,
      );
      workersToRun.push(domain.worker);
    }

    if (workersToRun.length > 0) {
      logger.info(`now run the workers: ${workersToRun.join(', ')}`);
    }

    await prismaWorker.$disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('scanner failed', { error });
    await prismaWorker.$disconnect();
    process.exit(1);
  }
}

scanAndQueueEntities();
