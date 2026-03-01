import logger from '../src/services/logger';
import prismaWorker from '../src/services/prisma-worker';

async function populate() {
    const start = Date.now();

    logger.info('🗑️  Truncating character_top_corporation_targets...');
    await prismaWorker.$executeRaw`TRUNCATE TABLE character_top_corporation_targets CASCADE`;

    logger.info('📊 Populating character_top_corporation_targets...');
    await prismaWorker.$executeRaw`
    INSERT INTO character_top_corporation_targets
      (character_id, corporation_id, kill_count, corporation_name, first_seen_at, last_seen_at)
    SELECT
      a.character_id,
      v.corporation_id,
      COUNT(*) as kill_count,
      co.name as corporation_name,
      MIN(k.killmail_time) as first_seen_at,
      MAX(k.killmail_time) as last_seen_at
    FROM attackers a
    INNER JOIN victims v ON a.killmail_id = v.killmail_id
    INNER JOIN killmails k ON a.killmail_id = k.killmail_id
    INNER JOIN corporations co ON v.corporation_id = co.id
    WHERE a.character_id IS NOT NULL
      AND v.corporation_id IS NOT NULL
    GROUP BY a.character_id, v.corporation_id, co.name
  `;

    const duration = Date.now() - start;
    const count = await prismaWorker.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM character_top_corporation_targets`;
    logger.info(`✅ character_top_corporation_targets: ${Number(count[0].count).toLocaleString()} records in ${(duration / 1000).toFixed(2)}s`);
}

populate()
    .then(() => process.exit(0))
    .catch((err) => { logger.error(err); process.exit(1); })
    .finally(() => prismaWorker.$disconnect());
