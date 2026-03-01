import logger from '../src/services/logger';
import prismaWorker from '../src/services/prisma-worker';

async function populate() {
    const start = Date.now();

    logger.info('🗑️  Truncating corporation_top_alliance_targets...');
    await prismaWorker.$executeRaw`TRUNCATE TABLE corporation_top_alliance_targets CASCADE`;

    logger.info('📊 Populating corporation_top_alliance_targets...');
    await prismaWorker.$executeRaw`
    INSERT INTO corporation_top_alliance_targets
      (corporation_id, alliance_id, kill_count, alliance_name, alliance_ticker, first_seen_at, last_seen_at)
    SELECT
      a.corporation_id,
      v.alliance_id,
      COUNT(*) as kill_count,
      al.name as alliance_name,
      al.ticker as alliance_ticker,
      MIN(k.killmail_time) as first_seen_at,
      MAX(k.killmail_time) as last_seen_at
    FROM attackers a
    INNER JOIN victims v ON a.killmail_id = v.killmail_id
    INNER JOIN killmails k ON a.killmail_id = k.killmail_id
    INNER JOIN alliances al ON v.alliance_id = al.id
    WHERE a.corporation_id IS NOT NULL
      AND v.alliance_id IS NOT NULL
    GROUP BY a.corporation_id, v.alliance_id, al.name, al.ticker
  `;

    const duration = Date.now() - start;
    const count = await prismaWorker.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM corporation_top_alliance_targets`;
    logger.info(`✅ corporation_top_alliance_targets: ${Number(count[0].count).toLocaleString()} records in ${(duration / 1000).toFixed(2)}s`);
}

populate()
    .then(() => process.exit(0))
    .catch((err) => { logger.error(err); process.exit(1); })
    .finally(() => prismaWorker.$disconnect());
