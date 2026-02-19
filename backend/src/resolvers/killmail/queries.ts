import { CACHE_TTL } from '@config/cache';
import { QueryResolvers } from '@generated-types';
import prisma from '@services/prisma';
import redis from '@services/redis';
import { filtersMaterialized } from './filters-materialized';

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

    // Create cache key based on all filter parameters
    const cacheKey = `killmails:list:${JSON.stringify({
      ...args.filter,
      page,
      limit,
      orderBy,
    })}`;

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log('✅ Cache hit for killmails query');
      return JSON.parse(cached);
    }

    // Determine filter strategy: Use Materialized View for entity filters
    const hasEntityFilter =
      args.filter?.shipTypeId ||
      args.filter?.characterId ||
      args.filter?.corporationId ||
      args.filter?.allianceId;

    if (hasEntityFilter) {
      console.log('🎯 Using Materialized View strategy for entity filters');

      // Use materialized view for faster queries
      const killmailIds = await filtersMaterialized(args.filter ?? {});

      if (killmailIds.length === 0) {
        // Early exit - no results
        const emptyResult = {
          items: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            currentPage: page,
            totalPages: 0,
            totalCount: 0,
          },
        };

        const ttl = page <= 3 ? CACHE_TTL.KILLMAIL_LIST_FIRST_PAGES : CACHE_TTL.KILLMAIL_LIST;
        const cacheDurationSeconds = Math.floor(ttl / 1000);
        await redis.setex(cacheKey, cacheDurationSeconds, JSON.stringify(emptyResult));

        return emptyResult;
      }

      // Build optional value filter conditions (total_value not in materialized view)
      // Two variants with different param indices:
      //   countWhereClause: $1=ids, $2=minValue, $3=maxValue
      //   mainWhereClause:  $1=ids, $2=limit, $3=skip, $4=minValue, $5=maxValue
      const valueParams: number[] = [];

      const countValueConditions: string[] = [];
      let countParamIdx = 2; // $1=ids

      const mainValueConditions: string[] = [];
      let mainParamIdx = 4; // $1=ids, $2=limit, $3=skip

      if (args.filter?.minValue !== undefined && args.filter?.minValue !== null) {
        countValueConditions.push(`total_value >= $${countParamIdx++}`);
        mainValueConditions.push(`total_value >= $${mainParamIdx++}`);
        valueParams.push(args.filter.minValue);
      }
      if (args.filter?.maxValue !== undefined && args.filter?.maxValue !== null) {
        countValueConditions.push(`total_value <= $${countParamIdx++}`);
        mainValueConditions.push(`total_value <= $${mainParamIdx++}`);
        valueParams.push(args.filter.maxValue);
      }
      const countWhereClause = countValueConditions.length > 0 ? ` AND ${countValueConditions.join(' AND ')}` : '';
      const mainWhereClause = mainValueConditions.length > 0 ? ` AND ${mainValueConditions.join(' AND ')}` : '';

      // If value filters are active, count against the killmails table directly
      let totalCount: number;
      if (valueParams.length > 0) {
        const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT COUNT(*) as count FROM killmails WHERE killmail_id = ANY($1::int[])${countWhereClause}`,
          killmailIds,
          ...valueParams
        );
        totalCount = Number(countResult[0].count);
      } else {
        // Use the length of killmailIds as total count to avoid extra query
        totalCount = killmailIds.length;
      }

      // For large result sets, use raw SQL with array to avoid parameter limit
      // PostgreSQL can handle large arrays efficiently with ANY()
      const orderDirection = orderBy === 'timeAsc' ? 'ASC' : 'DESC';

      const killmails = await prisma.$queryRawUnsafe<Array<{
        killmail_id: number;
        killmail_hash: string;
        killmail_time: Date;
        solar_system_id: number;
        created_at: Date;
        total_value: bigint | null;
        destroyed_value: bigint | null;
        dropped_value: bigint | null;
        attacker_count: number | null;
      }>>(
        `SELECT
          killmail_id,
          killmail_hash,
          killmail_time,
          solar_system_id,
          created_at,
          total_value,
          destroyed_value,
          dropped_value,
          attacker_count
        FROM killmails
        WHERE killmail_id = ANY($1::int[])${mainWhereClause}
        ORDER BY killmail_time ${orderDirection}
        LIMIT $2
        OFFSET $3`,
        killmailIds,
        limit,
        skip,
        ...valueParams
      );

      const totalPages = Math.ceil(totalCount / limit);

      // Map to GraphQL response format
      const items = killmails.map((km) => ({
        id: km.killmail_id.toString(),
        killmail_id: km.killmail_id,
        killmailHash: km.killmail_hash,
        killmailTime: km.killmail_time.toISOString(),
        solarSystemId: km.solar_system_id,
        createdAt: km.created_at.toISOString(),
        totalValue: km.total_value ? km.total_value.toString() : null,
        destroyedValue: km.destroyed_value ? km.destroyed_value.toString() : null,
        droppedValue: km.dropped_value ? km.dropped_value.toString() : null,
        attackerCount: km.attacker_count ?? 0,
      })) as any[];

      const result = {
        items,
        pageInfo: {
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
          currentPage: page,
          totalPages,
          totalCount,
        },
      };

      // Cache with appropriate TTL
      const ttl = page <= 3 ? CACHE_TTL.KILLMAIL_LIST_FIRST_PAGES : CACHE_TTL.KILLMAIL_LIST;
      const cacheDurationSeconds = Math.floor(ttl / 1000);
      await redis.setex(cacheKey, cacheDurationSeconds, JSON.stringify(result));

      return result;
    } else {
      console.log('🎯 Using standard Prisma query for location-only filters');

      // For location-only or simple filters, build WHERE directly
      const where: any = {};

      if (args.filter?.regionId) {
        where.solar_system = {
          constellation: {
            region_id: args.filter.regionId,
          },
        };
      }

      if (args.filter?.systemId) {
        where.solar_system_id = args.filter.systemId;
      }

      if (args.filter?.minAttackers !== undefined && args.filter?.minAttackers !== null) {
        where.attacker_count = {
          ...where.attacker_count,
          gte: args.filter.minAttackers,
        };
      }

      if (args.filter?.maxAttackers !== undefined && args.filter?.maxAttackers !== null) {
        where.attacker_count = {
          ...where.attacker_count,
          lte: args.filter.maxAttackers,
        };
      }

      if (args.filter?.minValue !== undefined && args.filter?.minValue !== null) {
        where.total_value = {
          ...where.total_value,
          gte: args.filter.minValue,
        };
      }

      if (args.filter?.maxValue !== undefined && args.filter?.maxValue !== null) {
        where.total_value = {
          ...where.total_value,
          lte: args.filter.maxValue,
        };
      }

      // Count total matching records for standard queries
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

      const result = {
        items,
        pageInfo: {
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
          currentPage: page,
          totalPages,
          totalCount,
        },
      };

      // Cache the result - use shorter TTL for first 3 pages (most frequently accessed)
      const ttl = page <= 3 ? CACHE_TTL.KILLMAIL_LIST_FIRST_PAGES : CACHE_TTL.KILLMAIL_LIST;
      const cacheDurationSeconds = Math.floor(ttl / 1000);
      await redis.setex(cacheKey, cacheDurationSeconds, JSON.stringify(result));

      return result;
    }
  },

  killmailsDateCounts: async (_, args, context) => {
    // Create cache key based on filter parameters
    const cacheKey = `killmails:dateCounts:${JSON.stringify(args.filter ?? {})}`;

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log('✅ Cache hit for killmailsDateCounts query');
      return JSON.parse(cached);
    }

    // Determine filter strategy
    const hasEntityFilter =
      args.filter?.shipTypeId ||
      args.filter?.characterId ||
      args.filter?.corporationId ||
      args.filter?.allianceId;

    let result: { date: string; count: number }[];

    if (hasEntityFilter) {
      console.log('🎯 Using Materialized View for date counts with entity filters');

      // Use materialized view for entity filters
      const killmailIds = await filtersMaterialized(args.filter ?? {});

      if (killmailIds.length === 0) {
        // Early exit - no results
        result = [];
      } else {
        // Pre-filter IDs by value if value filters are present
        let filteredIds = killmailIds;
        if (
          (args.filter?.minValue !== undefined && args.filter?.minValue !== null) ||
          (args.filter?.maxValue !== undefined && args.filter?.maxValue !== null)
        ) {
          const vConds: string[] = [];
          const vParams: any[] = [killmailIds];
          let vIdx = 2;
          if (args.filter?.minValue !== undefined && args.filter?.minValue !== null) {
            vConds.push(`total_value >= $${vIdx}`);
            vParams.push(args.filter.minValue);
            vIdx++;
          }
          if (args.filter?.maxValue !== undefined && args.filter?.maxValue !== null) {
            vConds.push(`total_value <= $${vIdx}`);
            vParams.push(args.filter.maxValue);
          }
          const filtered = await prisma.$queryRawUnsafe<Array<{ killmail_id: number }>>(
            `SELECT killmail_id FROM killmails WHERE killmail_id = ANY($1) AND ${vConds.join(' AND ')}`,
            ...vParams
          );
          filteredIds = filtered.map(r => r.killmail_id);
        }

        // Query by IDs (much faster than JOINs)
        const rawCounts = await prisma.$queryRawUnsafe<Array<{ date: Date; count: bigint }>>(
          `SELECT
            DATE(killmail_time) as date,
            COUNT(*)::bigint as count
          FROM killmails
          WHERE killmail_id = ANY($1::int[])
          GROUP BY DATE(killmail_time)
          ORDER BY date DESC`,
          filteredIds
        );

        result = rawCounts.map(item => ({
          date: new Date(item.date).toISOString().split('T')[0],
          count: Number(item.count),
        }));
      }
    } else if (!args.filter || Object.keys(args.filter).length === 0) {
      console.log('🎯 Using raw SQL for unfiltered date counts');

      // No filters - use raw SQL for best performance
      const rawResult = await prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT
          DATE(killmail_time) as date,
          COUNT(*)::bigint as count
        FROM killmails
        GROUP BY DATE(killmail_time)
        ORDER BY date DESC
      `;

      result = rawResult.map(row => ({
        date: row.date.toISOString().split('T')[0],
        count: Number(row.count),
      }));
    } else {
      console.log('🎯 Using Prisma for location-only date counts');

      // Location-only filters
      const where: any = {};

      if (args.filter?.regionId) {
        where.solar_system = {
          constellation: {
            region_id: args.filter.regionId,
          },
        };
      }

      if (args.filter?.systemId) {
        where.solar_system_id = args.filter.systemId;
      }

      if (args.filter?.minAttackers !== undefined && args.filter?.minAttackers !== null) {
        where.attacker_count = {
          ...where.attacker_count,
          gte: args.filter.minAttackers,
        };
      }

      if (args.filter?.maxAttackers !== undefined && args.filter?.maxAttackers !== null) {
        where.attacker_count = {
          ...where.attacker_count,
          lte: args.filter.maxAttackers,
        };
      }

      if (args.filter?.minValue !== undefined && args.filter?.minValue !== null) {
        where.total_value = {
          ...where.total_value,
          gte: args.filter.minValue,
        };
      }

      if (args.filter?.maxValue !== undefined && args.filter?.maxValue !== null) {
        where.total_value = {
          ...where.total_value,
          lte: args.filter.maxValue,
        };
      }

      // Fetch only killmail_time for date grouping
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
      result = Array.from(dateCounts.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date desc
    }

    // Cache the result (1 minute - frequently changes with new killmails)
    const cacheDurationSeconds = Math.floor(CACHE_TTL.KILLMAIL_LIST_FIRST_PAGES / 1000);
    await redis.setex(cacheKey, cacheDurationSeconds, JSON.stringify(result));

    return result;
  },

};

