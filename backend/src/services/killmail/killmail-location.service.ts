/**
 * The celestial a killmail's victim died nearest to, and how far from it.
 *
 * The victim's position (victims.position_x/y/z, from ESI) and every
 * positioned universe object are in the same frame: metres from the system's
 * star, which is why the star itself sits at 0,0,0. The nearest one is found
 * in SQL over the six kinds the universe map draws (map-celestials.service),
 * in three dimensions where the map only needs x and z.
 *
 * Player-owned structures are not among them and never will be: the project
 * leaves them out by design. A kill beside a citadel therefore reads as some
 * AU from the nearest moon — still the true distance to the nearest object we
 * know of, and shown as that.
 *
 * Batched for the killmailLocation DataLoader and cached per killmail, since
 * where a kill happened never changes. A killmail with no victim position
 * (about 0.2% of them) caches as null, so it is not queried again.
 */

import { Prisma } from '@generated/prisma/client';
import prisma from '@services/prisma';
import redis from '@services/redis';
import type { MapCelestialKind as CelestialKind } from '@services/universe/map-celestials.service';

export interface KillmailLocation {
  kind: CelestialKind;
  id: number;
  name: string | null;
  /** Metres from the victim to the celestial. */
  distance: number;
}

export const LOCATION_CACHE_TTL_SECONDS = 86400;

export function locationCacheKey(killmailId: number): string {
  return `killmail:location:${killmailId}`;
}

interface LocationRow {
  killmail_id: number;
  kind: CelestialKind;
  id: number;
  name: string | null;
  distance: number;
}

export async function getKillmailLocations(
  killmailIds: readonly number[],
): Promise<(KillmailLocation | null)[]> {
  if (killmailIds.length === 0) return [];

  const unique = [...new Set(killmailIds)];
  const cached = await redis.mget(unique.map(locationCacheKey));

  const found = new Map<number, KillmailLocation | null>();
  const misses: number[] = [];

  unique.forEach((killmailId, index) => {
    const entry = cached[index];
    if (entry === null || entry === undefined) {
      misses.push(killmailId);
      return;
    }
    found.set(killmailId, JSON.parse(entry) as KillmailLocation | null);
  });

  if (misses.length > 0) {
    // For each victim, every positioned object in its system, nearest first.
    // The UNION is filtered to that one system inside the LATERAL, so each
    // branch uses its solar_system_id index rather than scanning the table.
    const rows = await prisma.$queryRaw<LocationRow[]>`
      SELECT v.killmail_id, n.kind, n.id, n.name, n.distance
      FROM victims v
      JOIN killmails k ON k.killmail_id = v.killmail_id
      CROSS JOIN LATERAL (
        SELECT c.kind, c.id, c.name,
               sqrt(power(c.x - v.position_x, 2)
                  + power(c.y - v.position_y, 2)
                  + power(c.z - v.position_z, 2)) AS distance
        FROM (
          SELECT 'STAR' AS kind, st.star_id AS id, st.name,
                 0::DOUBLE PRECISION AS x, 0::DOUBLE PRECISION AS y,
                 0::DOUBLE PRECISION AS z
          FROM stars st WHERE st.solar_system_id = k.solar_system_id
          UNION ALL
          SELECT 'PLANET', p.planet_id, p.name,
                 p.position_x, p.position_y, p.position_z
          FROM planets p WHERE p.solar_system_id = k.solar_system_id
          UNION ALL
          SELECT 'MOON', m.moon_id, m.name,
                 m.position_x, m.position_y, m.position_z
          FROM moons m WHERE m.solar_system_id = k.solar_system_id
          UNION ALL
          SELECT 'BELT', b.asteroid_belt_id, b.name,
                 b.position_x, b.position_y, b.position_z
          FROM asteroid_belts b WHERE b.solar_system_id = k.solar_system_id
          UNION ALL
          SELECT 'STATION', s.station_id, s.name,
                 s.position_x, s.position_y, s.position_z
          FROM stations s WHERE s.solar_system_id = k.solar_system_id
          UNION ALL
          SELECT 'GATE', g.stargate_id, g.name,
                 g.position_x, g.position_y, g.position_z
          FROM stargates g WHERE g.solar_system_id = k.solar_system_id
        ) c
        WHERE c.x IS NOT NULL AND c.y IS NOT NULL AND c.z IS NOT NULL
        ORDER BY distance LIMIT 1
      ) n
      WHERE v.killmail_id IN (${Prisma.join(misses)})
        AND v.position_x IS NOT NULL
        AND v.position_y IS NOT NULL
        AND v.position_z IS NOT NULL
    `;

    for (const killmailId of misses) found.set(killmailId, null);
    for (const row of rows) {
      found.set(row.killmail_id, {
        kind: row.kind,
        id: row.id,
        name: row.name,
        distance: Number(row.distance),
      });
    }

    const writes = redis.pipeline();
    for (const killmailId of misses) {
      writes.setex(
        locationCacheKey(killmailId),
        LOCATION_CACHE_TTL_SECONDS,
        JSON.stringify(found.get(killmailId)),
      );
    }
    await writes.exec();
  }

  return killmailIds.map((killmailId) => found.get(killmailId) ?? null);
}
