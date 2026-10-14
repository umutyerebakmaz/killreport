/**
 * Fill solar_systems.position_2d_x/y from CCP's Static Data Export.
 *
 * The schematic 2D map — the layout of the in-game 2D map, which /map opens on
 * — is in the SDE's mapSolarSystems.jsonl as position2D and nowhere in ESI.
 *
 * Reads mapSolarSystems.jsonl on stdin; `yarn sde:map-2d` downloads the archive
 * and pipes the file in. Only systems already in the table are updated, and
 * only where the value changes. Static data: run by hand, again whenever a new
 * SDE build adds systems, never on a schedule.
 *
 * Run it before deploying code that reads these columns: until it has run the
 * schematic scene is empty, and /map opens on it. A re-run with a new build
 * reaches the API only once the response cache drops MapGeometry and
 * MapLabels, which it keeps as STATIC_GAME_DATA.
 */

import { createInterface } from 'node:readline';

import { parseMap2dLine } from '@helpers/sde-map-2d';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import redis from '@services/redis';
import {
  geometryCacheKey,
  labelsCacheKey,
} from '@services/universe/map-cache-keys';
import type { MapLabelKind } from '@services/universe/map-labels.service';
import type {
  MapProjection,
  MapScope,
} from '@services/universe/universe-map.service';

const CHUNK = 1_000;

const SCOPES: MapScope[] = ['NEW_EDEN', 'POCHVEN', 'WORMHOLE'];
const PROJECTIONS: MapProjection[] = ['SCHEMATIC', 'GALACTIC'];
const LABEL_KINDS: MapLabelKind[] = ['REGION', 'CONSTELLATION'];

async function importMap2d() {
  const rows: [number, number, number][] = [];
  let lines = 0;

  for await (const line of createInterface({ input: process.stdin })) {
    lines++;
    const row = parseMap2dLine(line);
    if (row) rows.push(row);
  }

  if (lines === 0) {
    throw new Error('no input on stdin: pipe the SDE mapSolarSystems.jsonl in');
  }
  logger.info(
    `read ${lines.toLocaleString()} systems, ${rows.length.toLocaleString()} with a schematic position`,
  );

  let updated = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const ids = chunk.map(([id]) => id);
    const xs = chunk.map(([, x]) => x);
    const ys = chunk.map(([, , y]) => y);

    // Existing rows only, and only where the value changes, so a re-run after
    // a new SDE build writes just the new and the moved systems.
    const result = await prismaWorker.$queryRaw<{ system_id: number }[]>`
      UPDATE solar_systems s
      SET position_2d_x = v.x, position_2d_y = v.y
      FROM unnest(${ids}::int[], ${xs}::float8[], ${ys}::float8[]) AS v(id, x, y)
      WHERE s.system_id = v.id
        AND (s.position_2d_x IS DISTINCT FROM v.x
             OR s.position_2d_y IS DISTINCT FROM v.y)
      RETURNING s.system_id
    `;
    updated += result.length;
  }

  // Every key the map services can have written, by name: no pattern scan over
  // a database another checkout may share.
  const keys = SCOPES.flatMap((scope) =>
    PROJECTIONS.flatMap((projection) => [
      geometryCacheKey(scope, projection),
      ...LABEL_KINDS.map((kind) => labelsCacheKey(scope, kind, projection)),
    ]),
  );
  await redis.del(...keys);

  logger.info(
    `updated the schematic position of ${updated.toLocaleString()} systems`,
  );
}

importMap2d()
  .then(async () => {
    await prismaWorker.$disconnect();
    redis.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error('sde map 2d import failed:', error);
    await prismaWorker.$disconnect();
    redis.disconnect();
    process.exit(1);
  });
