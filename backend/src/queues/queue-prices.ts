import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { ensureAllQueuesExist } from '@services/rabbitmq';
import { publishEntitiesConfirmed } from './publish-entities';

const QUEUE_NAME = 'esi_type_price_queue';

/**
 * Queues every type a killmail values, the victim's ship and every item, for
 * worker:prices. A type `types` does not have yet would fail the
 * `market_prices` foreign key, so it waits until scan:entities has added it
 * and is priced on the next run. The same SQL as the Rust
 * `queue-prices` (`backend-rs/queues/queue-prices/src/lib.rs`).
 */
async function queuePrices() {
  logger.info('fetching unique type IDs from killmail_items and victims...');

  try {
    // UNION already de-duplicates; EXISTS leaves only the known types
    const rows = await prismaWorker.$queryRaw<{ id: number }[]>`
      SELECT ids.id
      FROM (
        SELECT item_type_id AS id FROM killmail_items
        UNION
        SELECT ship_type_id FROM victims
      ) ids
      WHERE EXISTS (SELECT 1 FROM types t WHERE t.id = ids.id)
      ORDER BY ids.id
    `;
    const typeIds = rows.map((r) => r.id);

    logger.info(`found ${typeIds.length} types to price`);

    if (typeIds.length === 0) {
      logger.info('✅ no types to price!');
      process.exit(0);
    }

    logger.info(`adding to queue: ${QUEUE_NAME}`);

    await ensureAllQueuesExist();
    // Resolves only once the broker has confirmed every message, so the
    // process.exit below can no longer drop what it had not taken yet.
    const queuedCount = await publishEntitiesConfirmed(
      QUEUE_NAME,
      'queue-prices',
      typeIds,
      {
        onBatch: (batch, total, size) =>
          logger.info(`queued batch ${batch}/${total} (${size} types)`),
      },
    );

    logger.info(`✅ all ${queuedCount} types queued successfully!`);
    logger.info('now run the worker: yarn worker:prices');

    process.exit(0);
  } catch (error) {
    logger.error('failed to queue prices', { error });
    process.exit(1);
  }
}

queuePrices();
