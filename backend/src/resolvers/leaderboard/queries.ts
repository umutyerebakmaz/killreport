import { QueryResolvers } from '@generated-types';
import prisma from '@services/prisma';
import redis from '@services/redis';

/**
 * Leaderboard Query Resolvers
 *
 * Uses the character_kill_stats table for O(1) indexed lookups.
 * The table is pre-aggregated per (kill_date, character_id) and updated
 * in real-time via kill-stats-realtime.ts whenever a killmail is saved.
 *
 * Query cost: single index scan on (kill_date, kill_count DESC)
 * vs. the old approach: full GROUP BY scan over 15k+ attackers rows per day.
 */
/** Returns the Monday (UTC) of the week containing the given date string */
function getWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

export const leaderboardQueries: QueryResolvers = {
  topWeeklyPilots: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const today = new Date().toISOString().split('T')[0];
    const weekStart = filter?.weekStart
      ? getWeekMonday(filter.weekStart)
      : getWeekMonday(today);

    const cacheKey = `leaderboard:topWeeklyPilots:${weekStart}:${limit}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    type Row = { character_id: number; kill_count: bigint };
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT character_id, SUM(kill_count) AS kill_count
      FROM   character_kill_stats
      WHERE  kill_date >= ${weekStart}::date
        AND  kill_date <  (${weekStart}::date + INTERVAL '7 days')
      GROUP  BY character_id
      ORDER  BY kill_count DESC
      LIMIT  ${limit}
    `;

    if (rows.length === 0) return [];

    const characterIds = rows.map(r => r.character_id);
    const characters = await prisma.character.findMany({
      where: { id: { in: characterIds } },
    });
    const charMap = new Map(characters.map(c => [c.id, c]));

    const currentWeekStart = getWeekMonday(today);
    const isCurrentWeek = weekStart === currentWeekStart;

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

    await redis.setex(cacheKey, isCurrentWeek ? 300 : 3600, JSON.stringify(result));
    return result;
  },

  topPilots: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const targetDate = filter?.date ?? new Date().toISOString().split('T')[0];

    const cacheKey = `leaderboard:topPilots:${targetDate}:${limit}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fast leaderboard read from the character_kill_stats table
    // Index: idx_character_kill_stats_date_count → (kill_date, kill_count DESC)
    type Row = { character_id: number; kill_count: number };

    const rows = await prisma.$queryRaw<Row[]>`
            SELECT character_id, kill_count
            FROM   character_kill_stats
            WHERE  kill_date = ${targetDate}::date
            ORDER  BY kill_count DESC
            LIMIT  ${limit}
        `;

    if (rows.length === 0) {
      return [];
    }

    // Load full character rows in a single query
    const characterIds = rows.map(r => r.character_id);
    const characters = await prisma.character.findMany({
      where: { id: { in: characterIds } },
    });

    const charMap = new Map(characters.map(c => [c.id, c]));

    const result = rows.map((row, idx) => {
      const char = charMap.get(row.character_id);
      return {
        rank: idx + 1,
        killCount: row.kill_count,
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

    // Cache 5 minutes for today (real-time stats supersede on next killmail save),
    // 1 hour for past dates (those never change)
    const isToday = targetDate === new Date().toISOString().split('T')[0];
    await redis.setex(cacheKey, isToday ? 300 : 3600, JSON.stringify(result));

    return result;
  },

  topLast7DaysPilots: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const today = new Date().toISOString().split('T')[0];

    const cacheKey = `leaderboard:topLast7DaysPilots:${today}:${limit}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    type Row = { character_id: number; kill_count: bigint };
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT character_id, SUM(kill_count) AS kill_count
      FROM   character_kill_stats
      WHERE  kill_date >= (${today}::date - INTERVAL '6 days')
        AND  kill_date <= ${today}::date
      GROUP  BY character_id
      ORDER  BY kill_count DESC
      LIMIT  ${limit}
    `;

    if (rows.length === 0) return [];

    const characterIds = rows.map(r => r.character_id);
    const characters = await prisma.character.findMany({
      where: { id: { in: characterIds } },
    });
    const charMap = new Map(characters.map(c => [c.id, c]));

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

    // Cache 5 minutes (rolling data - refreshes daily)
    await redis.setex(cacheKey, 300, JSON.stringify(result));
    return result;
  },

  top90DaysPilots: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const today = new Date().toISOString().split('T')[0];

    const cacheKey = `leaderboard:top90DaysPilots:${today}:${limit}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    type Row = { character_id: number; kill_count: bigint };
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT character_id, SUM(kill_count) AS kill_count
      FROM   character_kill_stats
      WHERE  kill_date >= (${today}::date - INTERVAL '89 days')
      GROUP  BY character_id
      ORDER  BY kill_count DESC
      LIMIT  ${limit}
    `;

    if (rows.length === 0) return [];

    const characterIds = rows.map(r => r.character_id);
    const characters = await prisma.character.findMany({
      where: { id: { in: characterIds } },
    });
    const charMap = new Map(characters.map(c => [c.id, c]));

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

    // Cache 5 minutes (rolling data, updated real-time)
    await redis.setex(cacheKey, 300, JSON.stringify(result));
    return result;
  },

  topMonthlyPilots: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const today = new Date();
    const defaultMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
    const targetMonth = filter?.month ?? defaultMonth;

    // Derive first day of the month and first day of the next month
    const [year, month] = targetMonth.split('-').map(Number);
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonthStart = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const cacheKey = `leaderboard:topMonthlyPilots:${targetMonth}:${limit}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    type Row = { character_id: number; kill_count: bigint };
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT character_id, SUM(kill_count) AS kill_count
      FROM   character_kill_stats
      WHERE  kill_date >= ${monthStart}::date
        AND  kill_date <  ${nextMonthStart}::date
      GROUP  BY character_id
      ORDER  BY kill_count DESC
      LIMIT  ${limit}
    `;

    if (rows.length === 0) return [];

    const characterIds = rows.map(r => r.character_id);
    const characters = await prisma.character.findMany({
      where: { id: { in: characterIds } },
    });
    const charMap = new Map(characters.map(c => [c.id, c]));

    const isCurrentMonth = targetMonth === defaultMonth;

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

    await redis.setex(cacheKey, isCurrentMonth ? 300 : 3600, JSON.stringify(result));
    return result;
  },

  topLast7DaysCorporations: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const today = new Date().toISOString().split('T')[0];

    const cacheKey = `leaderboard:topLast7DaysCorporations:${today}:${limit}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    type Row = { corporation_id: number; kill_count: bigint };
    const rows = await prisma.$queryRaw<Row[]>`
            SELECT corporation_id, SUM(kill_count) AS kill_count
            FROM   corporation_kill_stats
            WHERE  kill_date >= (${today}::date - INTERVAL '6 days')
              AND  kill_date <= ${today}::date
            GROUP  BY corporation_id
            ORDER  BY kill_count DESC
            LIMIT  ${limit}
        `;

    if (rows.length === 0) return [];

    const corporationIds = rows.map(r => r.corporation_id);
    const corporations = await prisma.corporation.findMany({
      where: { id: { in: corporationIds } },
    });
    const corpMap = new Map(corporations.map(c => [c.id, c]));

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

    // Cache 5 minutes (rolling data)
    await redis.setex(cacheKey, 300, JSON.stringify(result));
    return result;
  },

  topLast7DaysAlliances: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const today = new Date().toISOString().split('T')[0];

    const cacheKey = `leaderboard:topLast7DaysAlliances:${today}:${limit}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    type Row = { alliance_id: number; kill_count: bigint };
    const rows = await prisma.$queryRaw<Row[]>`
            SELECT alliance_id, SUM(kill_count) AS kill_count
            FROM   alliance_kill_stats
            WHERE  kill_date >= (${today}::date - INTERVAL '6 days')
              AND  kill_date <= ${today}::date
            GROUP  BY alliance_id
            ORDER  BY kill_count DESC
            LIMIT  ${limit}
        `;

    if (rows.length === 0) return [];

    const allianceIds = rows.map(r => r.alliance_id);
    const alliances = await prisma.alliance.findMany({
      where: { id: { in: allianceIds } },
    });
    const allianceMap = new Map(alliances.map(a => [a.id, a]));

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

    // Cache 5 minutes (rolling data)
    await redis.setex(cacheKey, 300, JSON.stringify(result));
    return result;
  },

  topLast7DaysShips: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const today = new Date().toISOString().split('T')[0];

    const cacheKey = `leaderboard:topLast7DaysShips:${today}:${limit}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    type Row = { victim_ship_type_id: number; kill_count: bigint };
    const rows = await prisma.$queryRaw<Row[]>`
            SELECT victim_ship_type_id, COUNT(*)::BIGINT AS kill_count
            FROM   killmail_filters
            WHERE  killmail_time >= (${today}::date - INTERVAL '6 days')
              AND  killmail_time <= ${today}::date + INTERVAL '1 day'
              AND  victim_ship_type_id IS NOT NULL
            GROUP  BY victim_ship_type_id
            ORDER  BY kill_count DESC
            LIMIT  ${limit}
        `;

    if (rows.length === 0) return [];

    const shipTypeIds = rows.map(r => r.victim_ship_type_id);
    const shipTypes = await prisma.type.findMany({
      where: { id: { in: shipTypeIds } },
    });
    const shipTypeMap = new Map(shipTypes.map(s => [s.id, s]));

    const result = rows.map((row, idx) => {
      const shipType = shipTypeMap.get(row.victim_ship_type_id);
      return {
        rank: idx + 1,
        killCount: Number(row.kill_count),
        shipType: shipType ?? null,
      };
    });

    // Cache 5 minutes (rolling data)
    await redis.setex(cacheKey, 300, JSON.stringify(result));
    return result;
  },

  topLast7DaysAttackerShips: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const today = new Date().toISOString().split('T')[0];

    const cacheKey = `leaderboard:topLast7DaysAttackerShips:${today}:${limit}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    type Row = { ship_type_id: number; kill_count: bigint };
    const rows = await prisma.$queryRaw<Row[]>`
            SELECT a.ship_type_id, COUNT(*)::BIGINT AS kill_count
            FROM   attackers a
            INNER JOIN killmails k ON k.killmail_id = a.killmail_id
            WHERE  k.killmail_time >= (${today}::date - INTERVAL '6 days')
              AND  k.killmail_time <= ${today}::date + INTERVAL '1 day'
              AND  a.ship_type_id IS NOT NULL
            GROUP  BY a.ship_type_id
            ORDER  BY kill_count DESC
            LIMIT  ${limit}
        `;

    if (rows.length === 0) return [];

    const shipTypeIds = rows.map(r => r.ship_type_id);
    const shipTypes = await prisma.type.findMany({
      where: { id: { in: shipTypeIds } },
    });
    const shipTypeMap = new Map(shipTypes.map(s => [s.id, s]));

    const result = rows.map((row, idx) => {
      const shipType = shipTypeMap.get(row.ship_type_id);
      return {
        rank: idx + 1,
        killCount: Number(row.kill_count),
        shipType: shipType ?? null,
      };
    });

    // Cache 5 minutes (rolling data)
    await redis.setex(cacheKey, 300, JSON.stringify(result));
    return result;
  },
};
