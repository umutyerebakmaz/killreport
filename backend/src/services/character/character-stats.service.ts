/**
 * Character Statistics Service
 *
 * Handles independent queries for character statistics (top targets)
 * Uses Redis caching with smart TTL strategy for optimal performance
 */

import { Prisma } from '@generated/prisma/client';
import prisma from '@services/prisma';
import redis from '@services/redis';

/**
 * Returns a Prisma.Sql fragment for filtering killmail_time by TopTargetFilter enum.
 * Uses killmail_filters table with GIN indexes for fast queries.
 */
function timeFilter(filter: string | null | undefined): Prisma.Sql {
  switch (filter) {
    case 'LAST_90_DAYS': return Prisma.sql`AND kf.killmail_time >= NOW() - INTERVAL '90 days'`;
    case 'LAST_7_DAYS': return Prisma.sql`AND kf.killmail_time >= NOW() - INTERVAL '7 days'`;
    case 'TODAY': return Prisma.sql`AND DATE(kf.killmail_time) = CURRENT_DATE`;
    default: return Prisma.sql``; // ALL_TIME – no constraint
  }
}

/**
 * Generate cache key for character stats
 */
function getCacheKey(characterId: number, statType: string, filter?: string | null): string {
  const timeKey = filter || 'ALL_TIME';
  return `char_stats:${characterId}:${statType}:${timeKey}`;
}

/**
 * Calculate TTL based on time filter
 * - All-time queries: 1 hour (rarely changes)
 * - Last 7 days: 5 minutes (changes frequently)
 * - Last 90 days: 15 minutes
 * - Today: 2 minutes (most dynamic)
 */
function calculateTTL(filter?: string | null): number {
  switch (filter) {
    case 'TODAY': return 120;         // 2 minutes
    case 'LAST_7_DAYS': return 300;     // 5 minutes
    case 'LAST_90_DAYS': return 900;    // 15 minutes
    default: return 3600;             // 1 hour (ALL_TIME)
  }
}

/**
 * Top 10 alliances this character killed most.
 * Uses killmail_filters with GIN indexes - fast and simple.
 * Results are cached in Redis with smart TTL.
 */
export async function getTopAllianceTargets(
  characterId: number,
  filter?: string | null
): Promise<Array<{ killCount: number; alliance: any }>> {
  const cacheKey = getCacheKey(characterId, 'alliances', filter);

  // Check cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Query database
  type Row = {
    victim_alliance_id: number;
    alliance_name: string;
    alliance_ticker: string;
    kill_count: bigint;
  };

  const filterSql = timeFilter(filter);
  const results = await prisma.$queryRaw<Row[]>`
    SELECT
      kf.victim_alliance_id,
      a.name AS alliance_name,
      a.ticker AS alliance_ticker,
      COUNT(*)::BIGINT AS kill_count
    FROM killmail_filters kf
    INNER JOIN alliances a ON a.id = kf.victim_alliance_id
    WHERE ${characterId} = ANY(kf.attacker_character_ids)
      AND kf.victim_alliance_id IS NOT NULL
      ${filterSql}
    GROUP BY kf.victim_alliance_id, a.name, a.ticker
    ORDER BY kill_count DESC
    LIMIT 10
  `;

  const mapped = results.map((row: Row) => ({
    killCount: Number(row.kill_count),
    alliance: {
      id: row.victim_alliance_id,
      name: row.alliance_name,
      ticker: row.alliance_ticker,
    },
  }));

  // Cache with smart TTL
  const ttl = calculateTTL(filter);
  await redis.setex(cacheKey, ttl, JSON.stringify(mapped));

  return mapped;
}

/**
 * Top 10 corporations this character killed most.
 * Uses killmail_filters with GIN indexes - fast and simple.
 * Results are cached in Redis with smart TTL.
 */
export async function getTopCorporationTargets(
  characterId: number,
  filter?: string | null
): Promise<Array<{ killCount: number; corporation: any }>> {
  const cacheKey = getCacheKey(characterId, 'corporations', filter);

  // Check cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Query database
  type Row = {
    victim_corporation_id: number;
    corporation_name: string;
    corporation_ticker: string;
    kill_count: bigint;
  };

  const filterSql = timeFilter(filter);
  const results = await prisma.$queryRaw<Row[]>`
    SELECT
      kf.victim_corporation_id,
      co.name AS corporation_name,
      co.ticker AS corporation_ticker,
      COUNT(*)::BIGINT AS kill_count
    FROM killmail_filters kf
    INNER JOIN corporations co ON co.id = kf.victim_corporation_id
    WHERE ${characterId} = ANY(kf.attacker_character_ids)
      AND kf.victim_corporation_id IS NOT NULL
      ${filterSql}
    GROUP BY kf.victim_corporation_id, co.name, co.ticker
    ORDER BY kill_count DESC
    LIMIT 10
  `;

  const mapped = results.map((row: Row) => ({
    killCount: Number(row.kill_count),
    corporation: {
      id: row.victim_corporation_id,
      name: row.corporation_name,
      ticker: row.corporation_ticker,
    },
  }));

  // Cache with smart TTL
  const ttl = calculateTTL(filter);
  await redis.setex(cacheKey, ttl, JSON.stringify(mapped));

  return mapped;
}

/**
 * Top 10 ship types this character killed most.
 * Uses killmail_filters with GIN indexes - fast and simple.
 * Results are cached in Redis with smart TTL.
 */
export async function getTopShipTargets(
  characterId: number,
  filter?: string | null
): Promise<Array<{ killCount: number; shipType: any }>> {
  const cacheKey = getCacheKey(characterId, 'ships', filter);

  // Check cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Query database
  type Row = {
    victim_ship_type_id: number;
    ship_name: string;
    kill_count: bigint;
  };

  const filterSql = timeFilter(filter);
  const results = await prisma.$queryRaw<Row[]>`
    SELECT
      kf.victim_ship_type_id,
      t.name AS ship_name,
      COUNT(*)::BIGINT AS kill_count
    FROM killmail_filters kf
    INNER JOIN types t ON t.id = kf.victim_ship_type_id
    WHERE ${characterId} = ANY(kf.attacker_character_ids)
      AND kf.victim_ship_type_id IS NOT NULL
      ${filterSql}
    GROUP BY kf.victim_ship_type_id, t.name
    ORDER BY kill_count DESC
    LIMIT 10
  `;

  const mapped = results.map((row: Row) => ({
    killCount: Number(row.kill_count),
    shipType: {
      id: row.victim_ship_type_id,
      name: row.ship_name,
    },
  }));

  // Cache with smart TTL
  const ttl = calculateTTL(filter);
  await redis.setex(cacheKey, ttl, JSON.stringify(mapped));

  return mapped;
}

/**
 * Invalidate all character stats cache for a given character
 * Call this when new killmails are added for this character
 */
export async function invalidateCharacterStats(characterId: number): Promise<void> {
  const pattern = `char_stats:${characterId}:*`;

  // Get all matching keys
  const keys = await redis.keys(pattern);

  if (keys.length > 0) {
    // Delete all matching keys
    await redis.del(...keys);
  }
}
