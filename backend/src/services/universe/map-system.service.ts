import { Prisma } from '@generated/prisma/client';
import prisma from '@services/prisma';
import redis from '@services/redis';
import {
  OWNER_ID,
  OWNER_KIND,
  type MapOwnerKind,
} from './map-sovereignty.service';

/** Who holds this system, by the sovereignty layer's own rule. */
export interface MapSystemOwner {
  ownerId: number;
  kind: MapOwnerKind;
  name: string;
  /** Null on a faction: the factions table has no ticker column. */
  ticker: string | null;
}

/** One gate out of the system, and where it opens. */
export interface MapSystemStargate {
  stargateId: number;
  destinationSystemId: number;
  destinationName: string;
  destinationSecurityStatus: number | null;
}

export interface MapSystemDetails {
  systemId: number;
  name: string;
  securityStatus: number | null;
  constellationName: string;
  regionName: string;
  /** Null in unclaimed space, which is most of New Eden. */
  owner: MapSystemOwner | null;
  stargates: MapSystemStargate[];
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
 *
 * The two halves added on 2026-09-20 are both slower than that: sovereignty
 * moves on a day scale and the topology never moves at all. Neither of them
 * lengthens the key, because the shortest-lived field still sets it.
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
  owner_id: number | null;
  owner_kind: MapOwnerKind | null;
  owner_name: string | null;
  owner_ticker: string | null;
  /** json_agg's output, already in the popup's field names. */
  stargates: MapSystemStargate[];
  ship_kills: number | null;
  pod_kills: number | null;
  npc_kills: number | null;
  ship_jumps: number | null;
  snapshot_at: Date | null;
}

/**
 * Everything one system's popup shows, in one round trip.
 *
 * Four things are joined here rather than left to the client:
 *
 * - The constellation and region NAMES. mapGeometry's nodes carry only the ids,
 *   and the names live in mapLabels — which deliberately does not fetch the
 *   31 KB of constellation names below CONSTELLATION_LABEL_ZOOM. At galaxy zoom
 *   the client simply does not have them.
 * - The OWNER, by the same COALESCE the sovereignty layer draws with — the
 *   fragments are imported from that service rather than retyped, so the popup
 *   cannot disagree with the colour under the system it describes. The client
 *   could not answer this from `mapSovereignty` anyway: that query is scoped to
 *   the scene and is not fetched at all below the zoom its layer needs.
 * - The STARGATES, from `stargates`. Reading mapGeometry.edges undercounts:
 *   that query requires BOTH ends of an edge to be inside the scope, so a gate
 *   leading out of the scene is absent from the list entirely. The destination
 *   name rather than the gate's own, because every gate is called
 *   `Stargate (Perimeter)` and eight rows repeating the word "Stargate" under a
 *   heading that already says it carry one word of information each.
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

  const rows = await prisma.$queryRaw<DetailsRow[]>(Prisma.sql`
    SELECT
      s.system_id,
      s.name,
      TRUNC(s.security_status::numeric, 2)::DOUBLE PRECISION AS security_status,
      c.name AS constellation_name,
      r.name AS region_name,
      o.owner_id,
      o.kind AS owner_kind,
      o.name AS owner_name,
      o.ticker AS owner_ticker,
      g.stargates,
      a.ship_kills,
      a.pod_kills,
      a.npc_kills,
      a.ship_jumps,
      a.timestamp AS snapshot_at
    FROM solar_systems s
    JOIN constellations c ON c.constellation_id = s.constellation_id
    JOIN regions r ON r.region_id = c.region_id
    LEFT JOIN LATERAL (
      -- sovereignty_map_current is keyed on the system, so this is at most one
      -- row. The three name joins are guarded by the kind, so an alliance id
      -- that happens to equal a faction id cannot pick up the wrong name.
      SELECT held.owner_id,
             held.kind,
             COALESCE(al.name, co.name, f.name) AS name,
             COALESCE(al.ticker, co.ticker) AS ticker
      FROM (
        SELECT ${OWNER_ID} AS owner_id, ${OWNER_KIND} AS kind
        FROM sovereignty_map_current m
        WHERE m.solar_system_id = s.system_id
      ) held
      LEFT JOIN alliances al ON held.kind = 'ALLIANCE' AND al.id = held.owner_id
      LEFT JOIN corporations co
        ON held.kind = 'CORPORATION' AND co.id = held.owner_id
      LEFT JOIN factions f ON held.kind = 'FACTION' AND f.id = held.owner_id
      -- A row naming none of the three is not an owner; it is a stale entry.
      WHERE held.owner_id IS NOT NULL
    ) o ON TRUE
    LEFT JOIN LATERAL (
      -- Aggregated in SQL rather than returned as extra rows: a second result
      -- set would multiply the activity LATERAL by the gate count.
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'stargateId', sg.stargate_id,
            'destinationSystemId', sg.destination_system_id,
            'destinationName', d.name,
            -- The system's own security status is truncated, not rounded, and
            -- so is this one: rounding moves 14 systems into highsec, and a
            -- chip disagreeing with the panel it sits in would be worse than
            -- either rule on its own.
            'destinationSecurityStatus',
              TRUNC(d.security_status::numeric, 2)::DOUBLE PRECISION
          ) ORDER BY d.name
        ),
        '[]'::json
      ) AS stargates
      FROM stargates sg
      -- An inner join, so a gate whose destination the workers have not
      -- resolved is left out rather than listed with nowhere to go. All 13,978
      -- rows carry both as of 2026-09-20; this is what keeps that true here.
      JOIN solar_systems d ON d.system_id = sg.destination_system_id
      WHERE sg.solar_system_id = s.system_id
    ) g ON TRUE
    LEFT JOIN LATERAL (
      SELECT ship_kills, pod_kills, npc_kills, ship_jumps, timestamp
      FROM system_activity
      WHERE system_id = s.system_id
      ORDER BY timestamp DESC
      LIMIT 1
    ) a ON TRUE
    WHERE s.system_id = ${systemId}
  `);

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
    owner:
      row.owner_id === null || row.owner_kind === null
        ? null
        : {
            ownerId: Number(row.owner_id),
            kind: row.owner_kind,
            // The legend's rule, for the same reason: an owner the info
            // workers have not fetched yet still gets named, because a blank
            // beside the crest reads as a bug rather than as a gap in the
            // entity tables.
            name: row.owner_name ?? `#${Number(row.owner_id)}`,
            ticker: row.owner_ticker,
          },
    stargates: row.stargates,
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
