import logger from '../src/services/logger';
import prismaWorker from '../src/services/prisma-worker';

async function populate() {
    const start = Date.now();

    logger.info('🗑️  Truncating corporation_top_corporation_targets...');
    await prismaWorker.$executeRaw`TRUNCATE TABLE corporation_top_corporation_targets CASCADE`;

    logger.info('📊 Populating corporation_top_corporation_targets...');
    await prismaWorker.$executeRaw`
    INSERT INTO corporation_top_corporation_targets
      (corporation_id, target_corporation_id, kill_count, corporation_name, corporation_ticker, first_seen_at, last_seen_at)
    SELECT
      a.corporation_id,
      v.corporation_id as target_corporation_id,
      COUNT(*) as kill_count,
      co.name as corporation_name,
      co.ticker as corporation_ticker,
      MIN(k.killmail_time) as first_seen_at,
      MAX(k.killmail_time) as last_seen_at
    FROM attackers a
    INNER JOIN victims v ON a.killmail_id = v.killmail_id
    INNER JOIN killmails k ON a.killmail_id = k.killmail_id
    INNER JOIN corporations co ON v.corporation_id = co.id
    WHERE a.corporation_id IS NOT NULL
      AND v.corporation_id IS NOT NULL
      AND a.corporation_id != v.corporation_id
    GROUP BY a.corporation_id, v.corporation_id, co.name, co.ticker
  `;

    const duration = Date.now() - start;
    const count = await prismaWorker.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM corporation_top_corporation_targets`;
    logger.info(`✅ corporation_top_corporation_targets: ${Number(count[0].count).toLocaleString()} records in ${(duration / 1000).toFixed(2)}s`);
}

populate()
    .then(() => process.exit(0))
    .catch((err) => { logger.error(err); process.exit(1); })
    .finally(() => prismaWorker.$disconnect());
