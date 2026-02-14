import { CACHE_TTL } from '@config/cache';
import { QueryResolvers } from '@generated-types';
import prisma from '@services/prisma';
import redis from '@services/redis';
import { filters } from './filters';

/**
 * Killmail Query Resolvers
 * Handles fetching killmail data and listing killmails with filters
 */
export const killmailQueries: QueryResolvers = {
  killmail: async (_, { id }) => {
    const cacheKey = `killmail:detail:${id}`;

    // Check cache first
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const killmail = await prisma.killmail.findUnique({
      where: { killmail_id: Number(id) },
      select: {
        killmail_id: true,
        killmail_hash: true,
        killmail_time: true,
        solar_system_id: true,
        created_at: true,
        total_value: true,
        destroyed_value: true,
        dropped_value: true,
        attacker_count: true,
      }
    });

    if (!killmail) return null;

    // Field resolvers will handle victim, attackers, items via DataLoaders
    const result = {
      id: killmail.killmail_id.toString(),
      killmailHash: killmail.killmail_hash,
      killmailTime: killmail.killmail_time.toISOString(),
      solarSystemId: killmail.solar_system_id,
      createdAt: killmail.created_at.toISOString(),
      // Include cached values from database for performance
      totalValue: killmail.total_value,
      destroyedValue: killmail.destroyed_value,
      droppedValue: killmail.dropped_value,
      attackerCount: killmail.attacker_count ?? 0,
    } as any;

    // Cache using centralized config (90 days - killmails never change)
    const cacheDurationSeconds = Math.floor(CACHE_TTL.KILLMAIL_DETAIL / 1000);
    await redis.setex(cacheKey, cacheDurationSeconds, JSON.stringify(result));
    return result;
  },

  killmails: async (_, args) => {
    const page = args.filter?.page ?? 1;
    const limit = Math.min(args.filter?.limit ?? 25, 100); // Max 100 per page
    const orderBy = args.filter?.orderBy ?? 'timeDesc';

    const skip = (page - 1) * limit;

    // Build WHERE clause using centralized filter logic
    const where = filters(args.filter ?? {});

    // Count total matching records
    const totalCount = await prisma.killmail.count({ where });
    const totalPages = Math.ceil(totalCount / limit);

    // Fetch killmails - field resolvers will handle relations via DataLoaders
    const killmails = await prisma.killmail.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        killmail_time: orderBy === 'timeAsc' ? 'asc' : 'desc'
      },
      select: {
        killmail_id: true,
        killmail_hash: true,
        killmail_time: true,
        solar_system_id: true,
        created_at: true,
        total_value: true,
        destroyed_value: true,
        dropped_value: true,
        attacker_count: true,
      }
    });

    // Map to GraphQL response format
    const items = killmails.map((km) => ({
      id: km.killmail_id.toString(),
      killmail_id: km.killmail_id,
      killmailHash: km.killmail_hash,
      killmailTime: km.killmail_time.toISOString(),
      solarSystemId: km.solar_system_id,
      createdAt: km.created_at.toISOString(),
      // Include cached values from database for performance
      totalValue: km.total_value,
      destroyedValue: km.destroyed_value,
      droppedValue: km.dropped_value,
      attackerCount: km.attacker_count ?? 0,
    })) as any[];

    // Debug log for first killmail
    if (items.length > 0) {
      console.log('🔍 First killmail debug:', {
        id: killmails[0].killmail_id,
        attacker_count_from_db: killmails[0].attacker_count,
        attackerCount_mapped: items[0].attackerCount
      });
    }

    return {
      items,
      pageInfo: {
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        currentPage: page,
        totalPages,
        totalCount,
      },
    };
  },

  killmailsDateCounts: async (_, args) => {
    // Build WHERE clause using centralized filter logic
    const where = filters(args.filter ?? {});

    // For performance: use raw SQL when no filters, Prisma when filtered
    if (Object.keys(where).length === 0) {
      const result = await prisma.$queryRaw<{ date: Date; count: bigint }[]>`
                SELECT
                    DATE(killmail_time) as date,
                    COUNT(*)::bigint as count
                FROM killmails
                GROUP BY DATE(killmail_time)
                ORDER BY date DESC
            `;

      return result.map(row => ({
        date: row.date.toISOString().split('T')[0],
        count: Number(row.count),
      }));
    }

    // Fetch only killmail_time for date grouping (performance optimization)
    const killmails = await prisma.killmail.findMany({
      where,
      select: { killmail_time: true },
      orderBy: { killmail_time: 'desc' },
    });

    // Group by date
    const dateCounts = new Map<string, number>();
    for (const km of killmails) {
      const date = km.killmail_time.toISOString().split('T')[0]; // YYYY-MM-DD
      dateCounts.set(date, (dateCounts.get(date) || 0) + 1);
    }

    // Convert to array
    return Array.from(dateCounts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date desc
  },

};
