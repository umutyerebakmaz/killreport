/**
 * The sovereignty layer's data: who holds what, and how to name them.
 *
 * Two queries rather than one join: the pairs are 5,383 rows the client indexes
 * by system, the owners are 101 rows it indexes by owner, and repeating a name
 * on every pair would be most of the body for nothing.
 *
 * Measured 2026-09-20 against production: 5,383 pairs, 79 alliances and 22
 * factions, no row holding both and none holding neither.
 */

import { Prisma } from '@generated/prisma/client';
import prisma from '@services/prisma';
import redis from '@services/redis';
import {
  gatelessFilter,
  scopePredicate,
  type MapScope,
} from './universe-map.service';

export type MapOwnerKind = 'ALLIANCE' | 'FACTION' | 'CORPORATION';

export interface MapSovOwner {
  ownerId: number;
  kind: MapOwnerKind;
  name: string;
  /** Null on a faction: the factions table has no ticker column. */
  ticker: string | null;
  systemCount: number;
}

export interface MapSovSystem {
  systemId: number;
  ownerId: number;
}

export interface MapSovereignty {
  scope: MapScope;
  owners: MapSovOwner[];
  systems: MapSovSystem[];
  updatedAt: string | null;
}

/**
 * Not a row from CLAUDE.md's TTL table, and deliberately not.
 * `worker-sovereignty-map.ts` refreshes this and a system changing hands is a
 * day-scale event, so a quarter hour of staleness is fine for territory — but
 * it is not "never changes" either.
 */
export const SOV_CACHE_TTL_SECONDS = 900;

export function sovCacheKey(scope: MapScope): string {
  return `map:sov:${scope}`;
}

/**
 * The owner of a row, as one expression used by both queries.
 *
 * COALESCE order is the ownership rule: a row that names an alliance is held by
 * that alliance even though it also names the holding corporation. Measured
 * 2026-09-20: every alliance row carries a corporation id too, so reading the
 * corporation first would relabel all 2,712 of them.
 */
const OWNER_ID = Prisma.sql`COALESCE(m.alliance_id, m.corporation_id, m.faction_id)`;

const OWNER_KIND = Prisma.sql`CASE
  WHEN m.alliance_id IS NOT NULL THEN 'ALLIANCE'
  WHEN m.corporation_id IS NOT NULL THEN 'CORPORATION'
  ELSE 'FACTION'
END`;

/** The scene the geometry draws, so no owner can appear over an undrawn system. */
function ownedRows(scope: MapScope): Prisma.Sql {
  return Prisma.sql`
    FROM sovereignty_map_current m
    JOIN solar_systems s ON s.system_id = m.solar_system_id
    JOIN constellations c ON c.constellation_id = s.constellation_id
    WHERE ${scopePredicate(scope)}
      ${gatelessFilter(scope)}
      AND ${OWNER_ID} IS NOT NULL
  `;
}

interface SystemRow {
  system_id: number;
  owner_id: number;
}

interface OwnerRow {
  owner_id: number;
  kind: MapOwnerKind;
  name: string | null;
  ticker: string | null;
  system_count: bigint;
  updated_at: Date | null;
}

export async function getMapSovereignty(
  scope: MapScope,
): Promise<MapSovereignty> {
  const key = sovCacheKey(scope);
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as MapSovereignty;

  const rows = ownedRows(scope);

  const systemRows = await prisma.$queryRaw<SystemRow[]>(Prisma.sql`
    SELECT s.system_id AS system_id, ${OWNER_ID} AS owner_id
    ${rows}
    ORDER BY s.system_id
  `);

  // The three LEFT JOINs are guarded by the kind, so an alliance id that
  // happens to equal a faction id cannot pick up the wrong name.
  const ownerRows = await prisma.$queryRaw<OwnerRow[]>(Prisma.sql`
    WITH owned AS (
      SELECT ${OWNER_ID} AS owner_id, ${OWNER_KIND} AS kind, m.last_updated
      ${rows}
    )
    SELECT o.owner_id,
           o.kind,
           COALESCE(a.name, co.name, f.name) AS name,
           COALESCE(a.ticker, co.ticker) AS ticker,
           COUNT(*)::BIGINT AS system_count,
           MAX(o.last_updated) AS updated_at
    FROM owned o
    LEFT JOIN alliances a ON o.kind = 'ALLIANCE' AND a.id = o.owner_id
    LEFT JOIN corporations co ON o.kind = 'CORPORATION' AND co.id = o.owner_id
    LEFT JOIN factions f ON o.kind = 'FACTION' AND f.id = o.owner_id
    GROUP BY o.owner_id, o.kind, a.name, co.name, f.name, a.ticker, co.ticker
    ORDER BY system_count DESC, o.owner_id
  `);

  const owners: MapSovOwner[] = ownerRows.map((row) => ({
    ownerId: Number(row.owner_id),
    kind: row.kind,
    // An owner the info workers have not fetched yet still gets a row: the
    // legend is the only place the map admits it exists, and a blank name
    // there reads as a bug rather than as a gap in the entity tables.
    name: row.name ?? `#${Number(row.owner_id)}`,
    ticker: row.ticker,
    // COUNT(*) is BIGINT and JSON.stringify throws on it, so the conversion
    // happens before the value can reach the cache write below.
    systemCount: Number(row.system_count),
  }));

  const freshest = ownerRows.reduce<Date | null>((latest, row) => {
    if (!row.updated_at) return latest;
    return latest === null || row.updated_at > latest ? row.updated_at : latest;
  }, null);

  const sovereignty: MapSovereignty = {
    scope,
    owners,
    systems: systemRows.map((row) => ({
      systemId: Number(row.system_id),
      ownerId: Number(row.owner_id),
    })),
    updatedAt: freshest?.toISOString() ?? null,
  };

  // Cached even when empty: a scene with no sovereignty is a fact, not a miss.
  await redis.setex(key, SOV_CACHE_TTL_SECONDS, JSON.stringify(sovereignty));
  return sovereignty;
}
