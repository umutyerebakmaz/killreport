/**
 * Fill types.meta_group_id from CCP's Static Data Export.
 *
 * ESI's type endpoint has no meta group, and the metaGroupID dogma attribute
 * (1692) it sends is missing on many types — about 30% of faction hulls,
 * Phoenix Navy Issue among them — so the ship tier badge could not tell those
 * from Tech I. The SDE's types.jsonl carries metaGroupID on every type that
 * has one.
 *
 * Reads types.jsonl on stdin; `yarn sde:meta-groups` downloads the archive
 * and pipes the file in. Only types already in the table are updated, and
 * only their meta_group_id. Static data: run by hand, again whenever a new
 * SDE build adds ships, never on a schedule.
 */

import { createInterface } from 'node:readline';

import { parseMetaGroupLine } from '@helpers/sde-meta-group';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import redis from '@services/redis';

const CHUNK = 1_000;

async function importMetaGroups() {
  const pairs: [number, number][] = [];
  let lines = 0;

  for await (const line of createInterface({ input: process.stdin })) {
    lines++;
    const pair = parseMetaGroupLine(line);
    if (pair) pairs.push(pair);
  }

  if (lines === 0) {
    throw new Error('no input on stdin: pipe the SDE types.jsonl in');
  }
  logger.info(
    `read ${lines.toLocaleString()} types, ${pairs.length.toLocaleString()} with a meta group`,
  );

  const updatedIds: number[] = [];
  for (let i = 0; i < pairs.length; i += CHUNK) {
    const chunk = pairs.slice(i, i + CHUNK);
    const ids = chunk.map(([id]) => id);
    const metaGroups = chunk.map(([, meta]) => meta);

    // Existing rows only, and only where the value changes, so a re-run after
    // a new SDE build writes just the new and the changed types.
    const rows = await prismaWorker.$queryRaw<{ id: number }[]>`
      UPDATE types t
      SET meta_group_id = v.meta_group_id
      FROM unnest(${ids}::int[], ${metaGroups}::int[]) AS v(id, meta_group_id)
      WHERE t.id = v.id
        AND t.meta_group_id IS DISTINCT FROM v.meta_group_id
      RETURNING t.id
    `;
    updatedIds.push(...rows.map((row) => row.id));
  }

  // The type(id) query keeps a type's row in Redis for a day; an entry from
  // before this run would serve the old meta group, so the updated types'
  // entries go. Named keys only — no pattern scan over a shared database.
  for (let i = 0; i < updatedIds.length; i += CHUNK) {
    const keys = updatedIds
      .slice(i, i + CHUNK)
      .map((id) => `type:detail:${id}`);
    await redis.del(...keys);
  }

  logger.info(
    `updated meta_group_id on ${updatedIds.length.toLocaleString()} types`,
  );
}

importMetaGroups()
  .then(async () => {
    await prismaWorker.$disconnect();
    redis.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error('sde meta group import failed:', error);
    await prismaWorker.$disconnect();
    redis.disconnect();
    process.exit(1);
  });
