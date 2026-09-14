import prisma from '@services/prisma';
import redis from '@services/redis';

export interface MapSystemDetails {
  systemId: number;
  name: string;
  securityStatus: number | null;
  constellationName: string;
  regionName: string;
  gateCount: number;
  shipKills: number | null;
  podKills: number | null;
  npcKills: number | null;
  shipJumps: number | null;
  snapshotAt: string | null;
}

/**
 * Live data, so 300 s — CLAUDE.md's TTL for anything that changes today. The
 * activity half of this row changes hourly and is the shortest-lived thing in
 * it, which is what sets the TTL for the whole key.
 */
export const SYSTEM_DETAILS_CACHE_TTL_SECONDS = 300;

export function systemDetailsCacheKey(systemId: number): string {
  return `map:system:${systemId}`;
}

interface DetailsRow {
  system_id: number;
  name: string;
  security_status: number | null;
  constellation_name: string;
  region_name: string;
  /** COUNT(*) — a BigInt, which JSON.stringify throws on. */
  gate_count: bigint;
  ship_kills: number | null;
  pod_kills: number | null;
  npc_kills: number | null;
  ship_jumps: number | null;
  snapshot_at: Date | null;
}

/**
 * Everything one system's popup shows, in one round trip.
 *
 * Three things are joined here rather than left to the client:
 *
 * - The constellation and region NAMES. mapGeometry's nodes carry only the ids,
 *   and the names live in mapLabels — which deliberately does not fetch the
 *   31 KB of constellation names below CONSTELLATION_LABEL_ZOOM. At galaxy zoom
 *   the client simply does not have them.
 * - The gate count, from `stargates`. Counting mapGeometry.edges undercounts:
 *   that query requires BOTH ends of an edge to be inside the scope, so a gate
 *   leading out of the scene is absent from the list entirely.
 * - The latest activity snapshot, through a LATERAL so the whole thing stays
 *   one statement. system_activity's (system_id, timestamp) index serves the
 *   ORDER BY.
 */
export async function getMapSystemDetails(
  systemId: number,
): Promise<MapSystemDetails | null> {
  const key = systemDetailsCacheKey(systemId);
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as MapSystemDetails;

  const rows = await prisma.$queryRaw<DetailsRow[]>`
    SELECT
      s.system_id,
      s.name,
      TRUNC(s.security_status::numeric, 2)::DOUBLE PRECISION AS security_status,
      c.name AS constellation_name,
      r.name AS region_name,
      (SELECT COUNT(*) FROM stargates g WHERE g.solar_system_id = s.system_id)
        AS gate_count,
      a.ship_kills,
      a.pod_kills,
      a.npc_kills,
      a.ship_jumps,
      a.timestamp AS snapshot_at
    FROM solar_systems s
    JOIN constellations c ON c.constellation_id = s.constellation_id
    JOIN regions r ON r.region_id = c.region_id
    LEFT JOIN LATERAL (
      SELECT ship_kills, pod_kills, npc_kills, ship_jumps, timestamp
      FROM system_activity
      WHERE system_id = s.system_id
      ORDER BY timestamp DESC
      LIMIT 1
    ) a ON TRUE
    WHERE s.system_id = ${systemId}
  `;

  const row = rows[0];
  // Not cached: a null is indistinguishable from a miss on the way back in, and
  // an id that names no system is not worth a key.
  if (!row) return null;

  const details: MapSystemDetails = {
    systemId: Number(row.system_id),
    name: row.name,
    securityStatus: row.security_status,
    constellationName: row.constellation_name,
    regionName: row.region_name,
    // The one BigInt in the row. Left as it arrives, the JSON.stringify below
    // throws rather than returning a bad value — loud, but still a 500.
    gateCount: Number(row.gate_count),
    shipKills: row.ship_kills,
    podKills: row.pod_kills,
    npcKills: row.npc_kills,
    shipJumps: row.ship_jumps,
    snapshotAt: row.snapshot_at?.toISOString() ?? null,
  };

  await redis.setex(
    key,
    SYSTEM_DETAILS_CACHE_TTL_SECONDS,
    JSON.stringify(details),
  );
  return details;
}
