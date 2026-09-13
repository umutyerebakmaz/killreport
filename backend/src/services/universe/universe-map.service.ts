/**
 * Universe map geometry.
 *
 * One scene per scope, and every number in metres. The service hands out
 * galactic coordinates; turning them into something a GPU can hold is the
 * frontend's floating-origin job (`frontend/src/utils/map/origin.ts`).
 *
 * Measured 2026-09-13 against production: NEW_EDEN 5.241 nodes / 6.959 edges
 * in 111-123 ms + 9 ms, POCHVEN 27 / 30, WORMHOLE 2.604 / 0. Behind a 24 hour
 * Redis key, so those queries run once a day per scope.
 */

import { Prisma } from '@generated/prisma/client';
import prisma from '@services/prisma';
import redis from '@services/redis';

export type MapScope = 'NEW_EDEN' | 'POCHVEN' | 'WORMHOLE';

export interface MapNode {
  systemId: number;
  name: string;
  /** Galactic metres, rounded to COORDINATE_GRID_METRES. */
  x: number;
  z: number;
  /** Distance to the farthest celestial in the x/z plane, metres. */
  radius: number;
  /** Truncated to two decimals; see the note in getMapGeometry. */
  securityStatus: number;
  constellationId: number;
  regionId: number;
}

export interface MapEdge {
  from: number;
  to: number;
}

export interface MapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface MapGeometry {
  scope: MapScope;
  nodes: MapNode[];
  edges: MapEdge[];
  bounds: MapBounds;
}

const CACHE_TTL_SECONDS = 86400;

/**
 * Coordinates are rounded to this grid before they leave the service. 1e9 m is
 * 1e-4 ly, far under one pixel at every zoom this scene reaches, and it is what
 * takes the NEW_EDEN body from 229 KB gzip to 159 KB.
 */
export const COORDINATE_GRID_METRES = 1e9;

/**
 * Region id bands, measured 2026-09-13:
 *
 *   10000001-10001004  k-space, 70 regions, 5.485 systems (Pochven = 10000070)
 *   11000001-11000033  wormhole, 33 regions, 2.604 systems
 *   12000001-12000005  abyssal, 200 systems, zero celestials
 *   14000001-14000005  proving, 200 systems, zero celestials
 *   19000001           GPMR-01, one gateless system (GPMS-01), zero celestials
 *
 * The last three get no scene and no enum member: there is nothing inside them
 * to draw, and a scope that returns an empty scene is a trap. They are written
 * down here so the next reader does not have to measure them again.
 */
function scopePredicate(scope: MapScope): Prisma.Sql {
  switch (scope) {
    case 'NEW_EDEN':
      // Zarzakh (30000000+ id 30100000, region 10001000 Yasna Zakh) falls
      // inside this band and its four gates reach k-space, so it belongs here.
      // Pochven is cut out because it is a closed component - all 30 of its
      // edges are internal, so dropped into this scene its 27 systems would
      // land mid-cloud connected to nothing.
      return Prisma.sql`c.region_id BETWEEN 10000001 AND 10999999 AND c.region_id <> 10000070`;
    case 'POCHVEN':
      return Prisma.sql`c.region_id = 10000070`;
    case 'WORMHOLE':
      return Prisma.sql`c.region_id BETWEEN 11000001 AND 11999999`;
  }
}

/**
 * NEW_EDEN drops gateless systems - 217 Jove systems that sit far outside the
 * cloud and stretch the autofit. The other two scenes keep everything: wormhole
 * systems have no gates at all, so the same filter would empty the scene.
 */
function gatelessFilter(scope: MapScope): Prisma.Sql {
  return scope === 'NEW_EDEN'
    ? Prisma.sql`AND EXISTS (SELECT 1 FROM stargates g WHERE g.solar_system_id = s.system_id)`
    : Prisma.sql``;
}

interface NodeRow {
  system_id: number;
  name: string;
  x: number;
  z: number;
  radius: number;
  security_status: number;
  constellation_id: number;
  region_id: number;
}

interface EdgeRow {
  a: number;
  b: number;
}

function toGrid(value: number): number {
  return Math.round(value / COORDINATE_GRID_METRES) * COORDINATE_GRID_METRES;
}

/**
 * Bounds come from the nodes themselves rather than a third query, so the
 * camera's autofit and the thing actually drawn can never disagree. An empty
 * scene collapses to zero instead of ±Infinity; the camera treats a zero span
 * as "use the default zoom".
 */
export function computeBounds(nodes: MapNode[]): MapBounds {
  if (nodes.length === 0) {
    return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const node of nodes) {
    if (node.x < minX) minX = node.x;
    if (node.x > maxX) maxX = node.x;
    if (node.z < minZ) minZ = node.z;
    if (node.z > maxZ) maxZ = node.z;
  }

  return { minX, maxX, minZ, maxZ };
}

export async function getMapGeometry(scope: MapScope): Promise<MapGeometry> {
  const cacheKey = `map:geometry:${scope}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const predicate = scopePredicate(scope);
  const gateless = gatelessFilter(scope);

  // Security is truncated in SQL rather than in JS because numeric is exact
  // decimal: Math.trunc(0.29 * 100) / 100 is 0.28, since 0.29 * 100 is
  // 28.999999999999996 in IEEE-754. The ::DOUBLE PRECISION cast is not
  // decoration - without it Prisma hands back a Prisma.Decimal object and the
  // GraphQL Float! field receives an object.
  //
  // Rounding two decimals instead of truncating would move 14 systems whose
  // true security is between 0.495 and 0.5 up to 0.50, and the frontend's
  // >= 0.5 threshold would call them highsec.
  const nodeRowsPromise = prisma.$queryRaw<NodeRow[]>`
    WITH scoped AS (
      SELECT s.system_id, s.name, s.position_x, s.position_z,
             s.security_status, s.constellation_id, c.region_id
      FROM solar_systems s
      JOIN constellations c ON c.constellation_id = s.constellation_id
      WHERE ${predicate} ${gateless}
        AND s.position_x IS NOT NULL
        AND s.position_z IS NOT NULL
        AND s.security_status IS NOT NULL
    ),
    celestial AS (
      SELECT solar_system_id, position_x AS x, position_z AS z
      FROM planets WHERE solar_system_id IN (SELECT system_id FROM scoped)
      UNION ALL
      SELECT solar_system_id, position_x, position_z
      FROM moons WHERE solar_system_id IN (SELECT system_id FROM scoped)
      UNION ALL
      SELECT solar_system_id, position_x, position_z
      FROM asteroid_belts WHERE solar_system_id IN (SELECT system_id FROM scoped)
      UNION ALL
      SELECT solar_system_id, position_x, position_z
      FROM stations WHERE solar_system_id IN (SELECT system_id FROM scoped)
      UNION ALL
      SELECT solar_system_id, position_x, position_z
      FROM stargates WHERE solar_system_id IN (SELECT system_id FROM scoped)
    ),
    extent AS (
      SELECT solar_system_id, MAX(SQRT(x * x + z * z)) AS radius
      FROM celestial
      WHERE x IS NOT NULL AND z IS NOT NULL
      GROUP BY solar_system_id
    )
    SELECT
      scoped.system_id,
      scoped.name,
      scoped.position_x AS x,
      scoped.position_z AS z,
      COALESCE(extent.radius, 0) AS radius,
      TRUNC(scoped.security_status::numeric, 2)::DOUBLE PRECISION AS security_status,
      scoped.constellation_id,
      scoped.region_id
    FROM scoped
    LEFT JOIN extent ON extent.solar_system_id = scoped.system_id
    ORDER BY scoped.system_id
  `;

  // The same predicate, so an edge can never name a system the node list
  // dropped. LEAST/GREATEST + DISTINCT is what makes each pair appear once
  // with from < to: the stargates table holds both directions.
  const edgeRowsPromise = prisma.$queryRaw<EdgeRow[]>`
    WITH scoped AS (
      SELECT s.system_id
      FROM solar_systems s
      JOIN constellations c ON c.constellation_id = s.constellation_id
      WHERE ${predicate} ${gateless}
        AND s.position_x IS NOT NULL
        AND s.position_z IS NOT NULL
        AND s.security_status IS NOT NULL
    )
    SELECT DISTINCT
      LEAST(g.solar_system_id, g.destination_system_id) AS a,
      GREATEST(g.solar_system_id, g.destination_system_id) AS b
    FROM stargates g
    WHERE g.solar_system_id IN (SELECT system_id FROM scoped)
      AND g.destination_system_id IN (SELECT system_id FROM scoped)
    ORDER BY a, b
  `;

  const [nodeRows, edgeRows] = await Promise.all([
    nodeRowsPromise,
    edgeRowsPromise,
  ]);

  const nodes: MapNode[] = nodeRows.map((row) => ({
    systemId: row.system_id,
    name: row.name,
    x: toGrid(row.x),
    z: toGrid(row.z),
    radius: toGrid(row.radius),
    securityStatus: row.security_status,
    constellationId: row.constellation_id,
    regionId: row.region_id,
  }));

  const result: MapGeometry = {
    scope,
    nodes,
    edges: edgeRows.map((row) => ({ from: row.a, to: row.b })),
    bounds: computeBounds(nodes),
  };

  await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result));
  return result;
}
