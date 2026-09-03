import { CACHE_TTL } from '@config/cache';
import {
  CAPITAL_GROUP_IDS,
  NON_SHIP_GROUP_IDS,
  STRUCTURE_GROUP_IDS,
} from '@config/ship-groups';
import { Prisma } from '@generated/prisma/client';
import { MostValuableScope } from '@generated-types';
import prisma from '@services/prisma';
import redis from '@services/redis';

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;
const DEFAULT_DAYS = 7;
const MIN_DAYS = 1;
const MAX_DAYS = 90;

/**
 * One indexed query against killmail_filters, which carries the victim's ship
 * group and the cached ISK value alongside killmail_time. No joins: the field
 * resolvers pull victim, solarSystem and finalBlow through DataLoaders from the
 * id and solarSystemId returned here.
 */
interface MostValuableRow {
  killmail_id: number;
  killmail_time: Date;
  solar_system_id: number | null;
  total_value: number | null;
  attacker_count: number | null;
}

/**
 * Scope predicates. `<> ALL(...)` is the array form of NOT IN; a NULL group would
 * make it NULL rather than true, so the IS NOT NULL guard keeps unresolved hulls
 * out of the ship scopes instead of silently dropping the row.
 */
const SCOPE_PREDICATE: Record<MostValuableScope, Prisma.Sql> = {
  SHIPS: Prisma.sql`victim_ship_group_id IS NOT NULL
                      AND victim_ship_group_id <> ALL(${NON_SHIP_GROUP_IDS}::int[])`,
  STRUCTURES: Prisma.sql`victim_ship_group_id = ANY(${STRUCTURE_GROUP_IDS}::int[])`,
  CAPITALS: Prisma.sql`victim_ship_group_id = ANY(${CAPITAL_GROUP_IDS}::int[])`,
  SOLO: Prisma.sql`attacker_count = 1
                     AND victim_ship_group_id IS NOT NULL
                     AND victim_ship_group_id <> ALL(${NON_SHIP_GROUP_IDS}::int[])`,
};

export async function getMostValuableKillmails(
  scope: MostValuableScope,
  days?: number | null,
  limit?: number | null,
) {
  const cappedLimit = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const window = Math.min(Math.max(days ?? DEFAULT_DAYS, MIN_DAYS), MAX_DAYS);

  const cacheKey = `killmails:mostvaluable:${scope}:${window}:${cappedLimit}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const since = new Date(Date.now() - window * 24 * 60 * 60 * 1000);

  const rows = await prisma.$queryRaw<MostValuableRow[]>`
      SELECT killmail_id, killmail_time, solar_system_id, total_value, attacker_count
      FROM killmail_filters
      WHERE killmail_time >= ${since}
        -- Zero-valued rows (missing market_prices coverage at ingest time)
        -- sort to the bottom rather than being excluded here; nothing clears
        -- them, so the gap is permanent for those killmails.
        AND total_value IS NOT NULL
        AND ${SCOPE_PREDICATE[scope]}
      ORDER BY total_value DESC
      LIMIT ${cappedLimit}
    `;

  const items = rows.map((row) => ({
    id: row.killmail_id.toString(),
    killmailTime: row.killmail_time.toISOString(),
    totalValue: row.total_value,
    solarSystemId: row.solar_system_id,
    attackerCount: row.attacker_count ?? 0,
  }));

  // Rolling window, so the key carries no date and the TTL keeps it honest.
  await redis.setex(
    cacheKey,
    Math.floor(CACHE_TTL.KILLMAIL_LIST / 1000),
    JSON.stringify(items),
  );
  return items;
}
