/**
 * Celestials for a handful of systems, in metres, relative to the system centre.
 *
 * The cache key is per system rather than per request, and that is the design
 * rather than an optimisation: panning the focus one neighbour along changes the
 * requested set every step, so a per-request key would practically never hit.
 * Measured 2026-09-13: 59 celestials per system at the median, 103 at p95, 159
 * at the worst, and 2,329 for the hard cap of 16 systems.
 */

import { Prisma } from '@generated/prisma/client';
import prisma from '@services/prisma';
import redis from '@services/redis';

export type MapCelestialKind =
  'STAR' | 'PLANET' | 'MOON' | 'BELT' | 'STATION' | 'GATE';

export interface MapCelestial {
  id: number;
  systemId: number;
  name: string | null;
  kind: MapCelestialKind;
  /** Metres, relative to the system centre. Deliberately NOT rounded. */
  x: number;
  z: number;
  orbitIndex: number | null;
  planetId: number | null;
  destinationSystemId: number | null;
}

/**
 * The focus plus its gate neighbours is at most 9 systems (out-degree maxes at
 * 8, measured). 16 is twice that, and rejecting rather than truncating is the
 * point: a silently shortened list would draw a scene with holes in it.
 */
export const MAX_CELESTIAL_SYSTEMS = 16;

export const CELESTIALS_CACHE_TTL_SECONDS = 86400;

export function celestialsCacheKey(systemId: number): string {
  return `map:celestials:${systemId}`;
}

interface CelestialRow {
  kind: MapCelestialKind;
  id: number;
  solar_system_id: number;
  name: string | null;
  x: number;
  z: number;
  orbit_index: number | null;
  planet_id: number | null;
  destination_system_id: number | null;
}

function toCelestial(row: CelestialRow): MapCelestial {
  return {
    id: row.id,
    systemId: row.solar_system_id,
    name: row.name,
    kind: row.kind,
    x: row.x,
    z: row.z,
    orbitIndex: row.orbit_index,
    planetId: row.planet_id,
    destinationSystemId: row.destination_system_id,
  };
}

export async function getMapCelestials(
  systemIds: number[],
): Promise<MapCelestial[]> {
  if (systemIds.length === 0) return [];

  if (systemIds.length > MAX_CELESTIAL_SYSTEMS) {
    throw new Error(
      `mapCelestials accepts at most ${MAX_CELESTIAL_SYSTEMS} systems, got ${systemIds.length}`,
    );
  }

  const unique = [...new Set(systemIds)];
  const cached = await redis.mget(unique.map(celestialsCacheKey));

  const hits: MapCelestial[] = [];
  const misses: number[] = [];

  unique.forEach((systemId, index) => {
    const entry = cached[index];
    if (entry === null || entry === undefined) {
      misses.push(systemId);
      return;
    }
    hits.push(...(JSON.parse(entry) as MapCelestial[]));
  });

  if (misses.length === 0) return hits;

  // One round trip for six tables. The columns differ, so the ones a kind does
  // not have are filled with typed NULLs — the result is the flat array the map
  // wants, with `kind` as the discriminator.
  //
  // Every position is filtered for null. Today there are zero null positions
  // across all five positioned tables, but MapCelestial.x is Float! and the
  // setex below runs before GraphQL serialisation, so a single null would
  // return data: null AND sit in that system's cache entry for a day.
  const ids = Prisma.join(misses);

  const rows = await prisma.$queryRaw<CelestialRow[]>`
    SELECT 'STAR' AS kind, st.star_id AS id, st.solar_system_id, st.name,
           0::DOUBLE PRECISION AS x, 0::DOUBLE PRECISION AS z,
           NULL::INT AS orbit_index, NULL::INT AS planet_id,
           NULL::INT AS destination_system_id
    FROM stars st
    WHERE st.solar_system_id IN (${ids})
    UNION ALL
    SELECT 'PLANET', p.planet_id, p.solar_system_id, p.name,
           p.position_x, p.position_z, p.orbit_index, NULL, NULL
    FROM planets p
    WHERE p.solar_system_id IN (${ids})
      AND p.position_x IS NOT NULL AND p.position_z IS NOT NULL
    UNION ALL
    SELECT 'MOON', m.moon_id, m.solar_system_id, m.name,
           m.position_x, m.position_z, m.orbit_index, m.planet_id, NULL
    FROM moons m
    WHERE m.solar_system_id IN (${ids})
      AND m.position_x IS NOT NULL AND m.position_z IS NOT NULL
    UNION ALL
    SELECT 'BELT', b.asteroid_belt_id, b.solar_system_id, b.name,
           b.position_x, b.position_z, b.orbit_index, b.planet_id, NULL
    FROM asteroid_belts b
    WHERE b.solar_system_id IN (${ids})
      AND b.position_x IS NOT NULL AND b.position_z IS NOT NULL
    UNION ALL
    SELECT 'STATION', s.station_id, s.solar_system_id, s.name,
           s.position_x, s.position_z, NULL, NULL, NULL
    FROM stations s
    WHERE s.solar_system_id IN (${ids})
      AND s.position_x IS NOT NULL AND s.position_z IS NOT NULL
    UNION ALL
    SELECT 'GATE', g.stargate_id, g.solar_system_id, g.name,
           g.position_x, g.position_z, NULL, NULL, g.destination_system_id
    FROM stargates g
    WHERE g.solar_system_id IN (${ids})
      AND g.position_x IS NOT NULL AND g.position_z IS NOT NULL
    ORDER BY solar_system_id, kind, id
  `;

  // Group before caching: each system gets its own entry, including the empty
  // list for a system that has nothing, so it is not re-queried tomorrow.
  const bySystem = new Map<number, MapCelestial[]>(
    misses.map((systemId) => [systemId, []]),
  );
  for (const row of rows) {
    bySystem.get(row.solar_system_id)?.push(toCelestial(row));
  }

  const writes = redis.pipeline();
  for (const [systemId, celestials] of bySystem) {
    writes.setex(
      celestialsCacheKey(systemId),
      CELESTIALS_CACHE_TTL_SECONDS,
      JSON.stringify(celestials),
    );
  }
  await writes.exec();

  return [...hits, ...[...bySystem.values()].flat()];
}
