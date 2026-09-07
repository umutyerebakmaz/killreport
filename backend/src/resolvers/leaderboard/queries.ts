import { LeaderboardPeriod, QueryResolvers } from '@generated-types';
import { Prisma } from '@generated/prisma/client';
import prisma from '@services/prisma';
import redis from '@services/redis';

import { resolvePeriod } from './period';

/**
 * Leaderboard Query Resolvers
 *
 * Uses real-time aggregation tables (character_kill_stats, corporation_kill_stats, alliance_kill_stats)
 * for O(1) indexed lookups. These tables are updated IMMEDIATELY via atomic UPSERT operations
 * whenever a killmail is saved (transaction-based, zero latency).
 *
 * Query cost: single index scan on (kill_date, kill_count DESC)
 * vs. the old approach: full GROUP BY scan over 15k+ attackers rows per day.
 *
 * See: backend/docs/leaderboards/leaderboard-queries.md for architecture details.
 */
export const leaderboardQueries: QueryResolvers = {
  topPilots: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const period = filter?.period ?? LeaderboardPeriod.Last_7Days;
    const { startDate, endDate, cacheTtl, cacheAnchor } = resolvePeriod(
      period,
      filter?.anchor,
    );
    const systemId = filter?.systemId;
    const constellationId = filter?.constellationId;
    const regionId = filter?.regionId;

    const cacheKey = `leaderboard:topPilots:${period}:${cacheAnchor}:${limit}:${systemId || ''}:${constellationId || ''}:${regionId || ''}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    type Row = { character_id: number; kill_count: bigint };
    let rows: Row[];

    if (systemId || constellationId || regionId) {
      // Shape B: the daily stats table carries no location, so a spatial
      // filter has to go back to the killmails themselves.
      rows = await prisma.$queryRaw<Row[]>`
        SELECT a.character_id, COUNT(DISTINCT kf.killmail_id)::BIGINT AS kill_count
        FROM attackers a
        INNER JOIN killmail_filters kf ON kf.killmail_id = a.killmail_id
        WHERE kf.killmail_time >= ${startDate}::date
          AND kf.killmail_time <  ${endDate}::date + INTERVAL '1 day'
          AND a.character_id IS NOT NULL
          ${systemId ? Prisma.sql`AND kf.solar_system_id = ${systemId}` : Prisma.empty}
          ${constellationId ? Prisma.sql`AND kf.constellation_id = ${constellationId}` : Prisma.empty}
          ${regionId ? Prisma.sql`AND kf.region_id = ${regionId}` : Prisma.empty}
        GROUP BY a.character_id
        ORDER BY kill_count DESC
        LIMIT ${limit}
      `;
    } else {
      // Shape A: pre-aggregated daily counts, one index scan.
      rows = await prisma.$queryRaw<Row[]>`
        SELECT character_id, SUM(kill_count)::BIGINT AS kill_count
        FROM   character_kill_stats
        WHERE  kill_date >= ${startDate}::date
          AND  kill_date <= ${endDate}::date
        GROUP  BY character_id
        ORDER  BY kill_count DESC
        LIMIT  ${limit}
      `;
    }

    if (rows.length === 0) return [];

    const characterIds = rows.map((r) => r.character_id);
    const characters = await prisma.character.findMany({
      where: { id: { in: characterIds } },
    });
    const charMap = new Map(characters.map((c) => [c.id, c]));

    const result = rows.map((row, idx) => {
      const char = charMap.get(row.character_id);
      return {
        rank: idx + 1,
        killCount: Number(row.kill_count),
        character: char
          ? {
              ...char,
              securityStatus: char.security_status ?? null,
              birthday: char.birthday.toISOString(),
              updatedAt: char.updated_at?.toISOString() ?? null,
            }
          : null,
      };
    });

    await redis.setex(cacheKey, cacheTtl, JSON.stringify(result));
    return result;
  },

  topCorporations: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const period = filter?.period ?? LeaderboardPeriod.Last_7Days;
    const { startDate, endDate, cacheTtl, cacheAnchor } = resolvePeriod(
      period,
      filter?.anchor,
    );
    const systemId = filter?.systemId;
    const constellationId = filter?.constellationId;
    const regionId = filter?.regionId;

    const cacheKey = `leaderboard:topCorporations:${period}:${cacheAnchor}:${limit}:${systemId || ''}:${constellationId || ''}:${regionId || ''}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    type Row = { corporation_id: number; kill_count: bigint };
    let rows: Row[];

    if (systemId || constellationId || regionId) {
      rows = await prisma.$queryRaw<Row[]>`
        SELECT a.corporation_id, COUNT(DISTINCT kf.killmail_id)::BIGINT AS kill_count
        FROM attackers a
        INNER JOIN killmail_filters kf ON kf.killmail_id = a.killmail_id
        WHERE kf.killmail_time >= ${startDate}::date
          AND kf.killmail_time <  ${endDate}::date + INTERVAL '1 day'
          AND a.corporation_id IS NOT NULL
          ${systemId ? Prisma.sql`AND kf.solar_system_id = ${systemId}` : Prisma.empty}
          ${constellationId ? Prisma.sql`AND kf.constellation_id = ${constellationId}` : Prisma.empty}
          ${regionId ? Prisma.sql`AND kf.region_id = ${regionId}` : Prisma.empty}
        GROUP BY a.corporation_id
        ORDER BY kill_count DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await prisma.$queryRaw<Row[]>`
        SELECT corporation_id, SUM(kill_count)::BIGINT AS kill_count
        FROM   corporation_kill_stats
        WHERE  kill_date >= ${startDate}::date
          AND  kill_date <= ${endDate}::date
        GROUP  BY corporation_id
        ORDER  BY kill_count DESC
        LIMIT  ${limit}
      `;
    }

    if (rows.length === 0) return [];

    const corporationIds = rows.map((r) => r.corporation_id);
    const corporations = await prisma.corporation.findMany({
      where: { id: { in: corporationIds } },
    });
    const corpMap = new Map(corporations.map((c) => [c.id, c]));

    const result = rows.map((row, idx) => {
      const corp = corpMap.get(row.corporation_id);
      return {
        rank: idx + 1,
        killCount: Number(row.kill_count),
        corporation: corp
          ? {
              ...corp,
              shares: corp.shares ? Number(corp.shares) : null,
              updatedAt: corp.updated_at?.toISOString() ?? null,
            }
          : null,
      };
    });

    await redis.setex(cacheKey, cacheTtl, JSON.stringify(result));
    return result;
  },

  topAlliances: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const period = filter?.period ?? LeaderboardPeriod.Last_7Days;
    const { startDate, endDate, cacheTtl, cacheAnchor } = resolvePeriod(
      period,
      filter?.anchor,
    );
    const systemId = filter?.systemId;
    const constellationId = filter?.constellationId;
    const regionId = filter?.regionId;

    const cacheKey = `leaderboard:topAlliances:${period}:${cacheAnchor}:${limit}:${systemId || ''}:${constellationId || ''}:${regionId || ''}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    type Row = { alliance_id: number; kill_count: bigint };
    let rows: Row[];

    if (systemId || constellationId || regionId) {
      rows = await prisma.$queryRaw<Row[]>`
        SELECT a.alliance_id, COUNT(DISTINCT kf.killmail_id)::BIGINT AS kill_count
        FROM attackers a
        INNER JOIN killmail_filters kf ON kf.killmail_id = a.killmail_id
        WHERE kf.killmail_time >= ${startDate}::date
          AND kf.killmail_time <  ${endDate}::date + INTERVAL '1 day'
          AND a.alliance_id IS NOT NULL
          ${systemId ? Prisma.sql`AND kf.solar_system_id = ${systemId}` : Prisma.empty}
          ${constellationId ? Prisma.sql`AND kf.constellation_id = ${constellationId}` : Prisma.empty}
          ${regionId ? Prisma.sql`AND kf.region_id = ${regionId}` : Prisma.empty}
        GROUP BY a.alliance_id
        ORDER BY kill_count DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await prisma.$queryRaw<Row[]>`
        SELECT alliance_id, SUM(kill_count)::BIGINT AS kill_count
        FROM   alliance_kill_stats
        WHERE  kill_date >= ${startDate}::date
          AND  kill_date <= ${endDate}::date
        GROUP  BY alliance_id
        ORDER  BY kill_count DESC
        LIMIT  ${limit}
      `;
    }

    if (rows.length === 0) return [];

    const allianceIds = rows.map((r) => r.alliance_id);
    const alliances = await prisma.alliance.findMany({
      where: { id: { in: allianceIds } },
    });
    const allianceMap = new Map(alliances.map((a) => [a.id, a]));

    const result = rows.map((row, idx) => {
      const alliance = allianceMap.get(row.alliance_id);
      return {
        rank: idx + 1,
        killCount: Number(row.kill_count),
        alliance: alliance
          ? {
              ...alliance,
              updatedAt: alliance.updated_at?.toISOString() ?? null,
            }
          : null,
      };
    });

    await redis.setex(cacheKey, cacheTtl, JSON.stringify(result));
    return result;
  },

  topDestroyedShips: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const period = filter?.period ?? LeaderboardPeriod.Last_7Days;
    const { startDate, endDate, cacheTtl, cacheAnchor } = resolvePeriod(
      period,
      filter?.anchor,
    );
    const systemId = filter?.systemId;
    const constellationId = filter?.constellationId;
    const regionId = filter?.regionId;

    const cacheKey = `leaderboard:topDestroyedShips:${period}:${cacheAnchor}:${limit}:${systemId || ''}:${constellationId || ''}:${regionId || ''}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    type Row = { victim_ship_type_id: number; kill_count: bigint };
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT victim_ship_type_id, COUNT(*)::BIGINT AS kill_count
      FROM   killmail_filters
      WHERE  killmail_time >= ${startDate}::date
        AND  killmail_time <  ${endDate}::date + INTERVAL '1 day'
        AND  victim_ship_type_id IS NOT NULL
        ${systemId ? Prisma.sql`AND solar_system_id = ${systemId}` : Prisma.empty}
        ${constellationId ? Prisma.sql`AND constellation_id = ${constellationId}` : Prisma.empty}
        ${regionId ? Prisma.sql`AND region_id = ${regionId}` : Prisma.empty}
      GROUP  BY victim_ship_type_id
      ORDER  BY kill_count DESC
      LIMIT  ${limit}
    `;

    if (rows.length === 0) return [];

    const shipTypeIds = rows.map((r) => r.victim_ship_type_id);
    const shipTypes = await prisma.type.findMany({
      where: { id: { in: shipTypeIds } },
    });
    const shipTypeMap = new Map(shipTypes.map((s) => [s.id, s]));

    const result = rows.map((row, idx) => ({
      rank: idx + 1,
      killCount: Number(row.kill_count),
      shipType: shipTypeMap.get(row.victim_ship_type_id) ?? null,
    }));

    await redis.setex(cacheKey, cacheTtl, JSON.stringify(result));
    return result;
  },

  topAttackerShips: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const period = filter?.period ?? LeaderboardPeriod.Last_7Days;
    const { startDate, endDate, cacheTtl, cacheAnchor } = resolvePeriod(
      period,
      filter?.anchor,
    );
    const systemId = filter?.systemId;
    const constellationId = filter?.constellationId;
    const regionId = filter?.regionId;

    const cacheKey = `leaderboard:topAttackerShips:${period}:${cacheAnchor}:${limit}:${systemId || ''}:${constellationId || ''}:${regionId || ''}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // COUNT(*), not COUNT(DISTINCT killmail_id): the question is how many
    // pilots flew this hull, so a five-Raven fleet counts five.
    //
    // The spatial columns are written inline with an "IS NULL OR" guard
    // rather than the ternary-Prisma.sql fragment the other resolvers use:
    // a nested Prisma.sql value is opaque to the outer query text, and this
    // is the query that previously had no spatial filter at all, so it is
    // worth being able to see kf.solar_system_id land on the right side of
    // the join at a glance rather than trusting a conditional fragment.
    type Row = { ship_type_id: number; kill_count: bigint };
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT a.ship_type_id, COUNT(*)::BIGINT AS kill_count
      FROM   attackers a
      INNER JOIN killmail_filters kf ON kf.killmail_id = a.killmail_id
      WHERE  kf.killmail_time >= ${startDate}::date
        AND  kf.killmail_time <  ${endDate}::date + INTERVAL '1 day'
        AND  a.ship_type_id IS NOT NULL
        AND  (${systemId ?? null}::int IS NULL OR kf.solar_system_id = ${systemId ?? null})
        AND  (${constellationId ?? null}::int IS NULL OR kf.constellation_id = ${constellationId ?? null})
        AND  (${regionId ?? null}::int IS NULL OR kf.region_id = ${regionId ?? null})
      GROUP  BY a.ship_type_id
      ORDER  BY kill_count DESC
      LIMIT  ${limit}
    `;

    if (rows.length === 0) return [];

    const shipTypeIds = rows.map((r) => r.ship_type_id);
    const shipTypes = await prisma.type.findMany({
      where: { id: { in: shipTypeIds } },
    });
    const shipTypeMap = new Map(shipTypes.map((s) => [s.id, s]));

    const result = rows.map((row, idx) => ({
      rank: idx + 1,
      killCount: Number(row.kill_count),
      shipType: shipTypeMap.get(row.ship_type_id) ?? null,
    }));

    await redis.setex(cacheKey, cacheTtl, JSON.stringify(result));
    return result;
  },
};
