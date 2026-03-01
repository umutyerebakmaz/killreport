import logger from '../src/services/logger';
import prismaWorker from '../src/services/prisma-worker';

async function populate() {
    const start = Date.now();

    logger.info('🗑️  Truncating corporation_top_ships...');
    await prismaWorker.$executeRaw`TRUNCATE TABLE corporation_top_ships CASCADE`;

    logger.info('📊 Populating corporation_top_ships...');
    await prismaWorker.$executeRaw`
    INSERT INTO corporation_top_ships
      (corporation_id, ship_type_id, kill_count, ship_name, first_seen_at, last_seen_at)
    SELECT
      a.corporation_id,
      v.ship_type_id,
      COUNT(*) as kill_count,
      t.name as ship_name,
      MIN(k.killmail_time) as first_seen_at,
      MAX(k.killmail_time) as last_seen_at
    FROM attackers a
    INNER JOIN victims v ON a.killmail_id = v.killmail_id
    INNER JOIN killmails k ON a.killmail_id = k.killmail_id
    INNER JOIN types t ON v.ship_type_id = t.id
    WHERE a.corporation_id IS NOT NULL
      AND v.ship_type_id IS NOT NULL
    GROUP BY a.corporation_id, v.ship_type_id, t.name
  `;

    const duration = Date.now() - start;
    const count = await prismaWorker.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM corporation_top_ships`;
    logger.info(`✅ corporation_top_ships: ${Number(count[0].count).toLocaleString()} records in ${(duration / 1000).toFixed(2)}s`);
}

populate()
    .then(() => process.exit(0))
    .catch((err) => { logger.error(err); process.exit(1); })
    .finally(() => prismaWorker.$disconnect());
