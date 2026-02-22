import { QueryResolvers } from '@generated-types';
import prisma from '@services/prisma';
import redis from '@services/redis';

/**
 * Leaderboard Query Resolvers
 *
 * Uses the daily_pilot_kills_mv materialized view for O(1) indexed lookups.
 * The view is pre-aggregated per (kill_date, character_id) and refreshed every
 * 5 minutes by the scheduled materialized-view refresh service.
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
      FROM   daily_pilot_kills_mv
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

    // Fast leaderboard read from the materialized view
    // Index: idx_daily_pilot_kills_mv_date_count → (kill_date, kill_count DESC)
    type Row = { character_id: number; kill_count: number };

    const rows = await prisma.$queryRaw<Row[]>`
            SELECT character_id, kill_count
            FROM   daily_pilot_kills_mv
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
            birthday: char.birthday.toISOString(),
            updatedAt: char.updated_at?.toISOString() ?? null,
          }
          : null,
      };
    });

    // Cache 5 minutes for today (next mv refresh will supersede anyway),
    // 1 hour for past dates (those never change)
    const isToday = targetDate === new Date().toISOString().split('T')[0];
    await redis.setex(cacheKey, isToday ? 300 : 3600, JSON.stringify(result));

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
      FROM   daily_pilot_kills_mv
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
            birthday: char.birthday.toISOString(),
            updatedAt: char.updated_at?.toISOString() ?? null,
          }
          : null,
      };
    });

    // Cache 5 minutes (refreshes with MV)
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
      FROM   daily_pilot_kills_mv
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
            birthday: char.birthday.toISOString(),
            updatedAt: char.updated_at?.toISOString() ?? null,
          }
          : null,
      };
    });

    await redis.setex(cacheKey, isCurrentMonth ? 300 : 3600, JSON.stringify(result));
    return result;
  },
};

