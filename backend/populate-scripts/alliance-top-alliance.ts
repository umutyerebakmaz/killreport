import logger from '../src/services/logger';
import prismaWorker from '../src/services/prisma-worker';

async function populate() {
    const start = Date.now();

    logger.info('🗑️  Truncating alliance_top_alliance_targets...');
    await prismaWorker.$executeRaw`TRUNCATE TABLE alliance_top_alliance_targets CASCADE`;

    logger.info('📊 Populating alliance_top_alliance_targets...');
    await prismaWorker.$executeRaw`
    INSERT INTO alliance_top_alliance_targets
      (alliance_id, target_alliance_id, kill_count, alliance_name, alliance_ticker, first_seen_at, last_seen_at)
    SELECT
      a.alliance_id,
      v.alliance_id as target_alliance_id,
      COUNT(*) as kill_count,
      al.name as alliance_name,
      al.ticker as alliance_ticker,
      MIN(k.killmail_time) as first_seen_at,
      MAX(k.killmail_time) as last_seen_at
    FROM attackers a
    INNER JOIN victims v ON a.killmail_id = v.killmail_id
    INNER JOIN killmails k ON a.killmail_id = k.killmail_id
    INNER JOIN alliances al ON v.alliance_id = al.id
    WHERE a.alliance_id IS NOT NULL
      AND v.alliance_id IS NOT NULL
      AND a.alliance_id != v.alliance_id
    GROUP BY a.alliance_id, v.alliance_id, al.name, al.ticker
  `;

    const duration = Date.now() - start;
    const count = await prismaWorker.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM alliance_top_alliance_targets`;
    logger.info(`✅ alliance_top_alliance_targets: ${Number(count[0].count).toLocaleString()} records in ${(duration / 1000).toFixed(2)}s`);
}

populate()
    .then(() => process.exit(0))
    .catch((err) => { logger.error(err); process.exit(1); })
    .finally(() => prismaWorker.$disconnect());
