import prisma from '@services/prisma';
import redis from '@services/redis';

export interface SolarSystemStats {
  systemId: number;
  totalKills: number;
  totalIskDestroyed: number;
  kills24h: number;
  kills7d: number;
  iskDestroyed7d: number;
  lastKillTime: string | null;
  busiestHourUtc: number | null;
}

interface TotalsRow {
  total_kills: bigint;
  total_isk: number;
  kills_24h: bigint;
  kills_7d: bigint;
  isk_7d: number;
  last_kill_time: Date | null;
}

interface HourRow {
  hour: number;
  kill_count: bigint;
}

const CACHE_TTL_SECONDS = 300;

/**
 * Kill statistics for one solar system.
 *
 * Reads `killmails` rather than `killmail_filters`: that table has no
 * total_value column. Killmails whose value was never backfilled count as 0
 * rather than being excluded, which is how KillmailOrderBy.ValueDesc already
 * behaves.
 *
 * Both queries are covered by the (solar_system_id, killmail_time) composite
 * index.
 */
export class SolarSystemStatsService {
  static async getStats(systemId: number): Promise<SolarSystemStats> {
    const cacheKey = `solarSystem:stats:${systemId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [totals] = await prisma.$queryRaw<TotalsRow[]>`
            SELECT
                COUNT(*)::BIGINT AS total_kills,
                COALESCE(SUM(total_value), 0)::DOUBLE PRECISION AS total_isk,
                COUNT(*) FILTER (WHERE killmail_time >= NOW() - INTERVAL '24 hours')::BIGINT AS kills_24h,
                COUNT(*) FILTER (WHERE killmail_time >= NOW() - INTERVAL '7 days')::BIGINT AS kills_7d,
                COALESCE(SUM(total_value) FILTER (WHERE killmail_time >= NOW() - INTERVAL '7 days'), 0)::DOUBLE PRECISION AS isk_7d,
                MAX(killmail_time) AS last_kill_time
            FROM killmails
            WHERE solar_system_id = ${systemId}
        `;

    // Ties break on the lower hour so the cached answer is stable between
    // refreshes.
    const busiest = await prisma.$queryRaw<HourRow[]>`
            SELECT EXTRACT(HOUR FROM killmail_time AT TIME ZONE 'UTC')::INT AS hour,
                   COUNT(*)::BIGINT AS kill_count
            FROM killmails
            WHERE solar_system_id = ${systemId}
              AND killmail_time >= NOW() - INTERVAL '7 days'
            GROUP BY 1
            ORDER BY kill_count DESC, hour ASC
            LIMIT 1
        `;

    // ::BIGINT arrives as a JavaScript BigInt, and JSON.stringify throws on
    // those, so every count is converted before it reaches the cache.
    const result: SolarSystemStats = {
      systemId,
      totalKills: Number(totals?.total_kills ?? 0),
      totalIskDestroyed: totals?.total_isk ?? 0,
      kills24h: Number(totals?.kills_24h ?? 0),
      kills7d: Number(totals?.kills_7d ?? 0),
      iskDestroyed7d: totals?.isk_7d ?? 0,
      lastKillTime: totals?.last_kill_time?.toISOString() ?? null,
      busiestHourUtc: busiest.length > 0 ? busiest[0].hour : null,
    };

    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result));
    return result;
  }
}
