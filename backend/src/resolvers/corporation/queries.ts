import { Corporation, PageInfo, QueryResolvers } from '@generated-types';
import prisma from '@services/prisma';
import redis from '@services/redis';

/**
 * Corporation Query Resolvers
 * Handles fetching corporation data and listing corporations with filters
 */
export const corporationQueries: QueryResolvers = {
  corporation: async (_, { id }): Promise<Corporation | null> => {
    const cacheKey = `corporation:detail:${id}`;

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const corp = await prisma.corporation.findUnique({
      where: { id: Number(id) },
    });

    if (!corp) return null;

    // Field resolver'lar eksik field'ları otomatik doldurur
    const result = {
      ...corp,
      date_founded: corp.date_founded?.toISOString() || null,
      // BigInt'i String'e dönüştür (JSON.stringify BigInt'i serialize edemez)
      shares: corp.shares ? corp.shares.toString() : null,
    } as any;

    // Cache for 30 minutes (corporation info updates occasionally)
    await redis.setex(cacheKey, 1800, JSON.stringify(result));
    return result;
  },

  corporations: async (_, { filter }) => {
    const page = filter?.page || 1;
    const limit = filter?.limit || 25;
    const skip = (page - 1) * limit;

    // Build where clause for filters
    const where: any = {
      // Filter out NPC corporations (player corporations have ID >= 2000000)
      id: { gte: 2000000 }
    };

    if (filter?.search) {
      // Trim Input: trim and replace multiple spaces with single space
      const trim = filter.search.trim().replace(/\s+/g, ' ');
      where.name = { startsWith: trim, mode: 'insensitive' };
    }

    if (filter?.name) {
      // Normalize name: trim and replace multiple spaces with single space
      const trim = filter.name.trim().replace(/\s+/g, ' ');
      where.name = { startsWith: trim, mode: 'insensitive' };
    }

    if (filter?.ticker) {
      where.ticker = { contains: filter.ticker, mode: 'insensitive' };
    }

    if (filter?.allianceId) {
      where.alliance_id = filter.allianceId;
    }

    if (filter?.dateFoundedFrom || filter?.dateFoundedTo) {
      where.date_founded = {};
      if (filter?.dateFoundedFrom) {
        where.date_founded.gte = new Date(filter.dateFoundedFrom);
      }
      if (filter?.dateFoundedTo) {
        where.date_founded.lte = new Date(filter.dateFoundedTo);
      }
    }

    // orderBy
    let orderBy: any = { member_count: 'desc' }; // default

    if (filter?.orderBy) {
      switch (filter.orderBy) {
        case 'nameAsc':
          orderBy = { name: 'asc' };
          break;
        case 'nameDesc':
          orderBy = { name: 'desc' };
          break;
        case 'memberCountAsc':
          orderBy = { member_count: 'asc' };
          break;
        case 'memberCountDesc':
          orderBy = { member_count: 'desc' };
          break;
      }
    }

    const [corporations, totalCount] = await Promise.all([
      prisma.corporation.findMany({
        where,
        take: limit,
        skip,
        orderBy,
      }),
      prisma.corporation.count({ where }),
    ]);

    const items = corporations.map((corp: any) => ({
      ...corp,
      date_founded: corp.date_founded?.toISOString() || null,
      // BigInt'i String'e dönüştür (JSON.stringify BigInt'i serialize edemez)
      shares: corp.shares ? corp.shares.toString() : null,
    })) as any[]; // Field resolver'lar eksik field'ları otomatik doldurur

    const totalPages = Math.ceil(totalCount / limit);

    const pageInfo: PageInfo = {
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      currentPage: page,
      totalPages,
      totalCount,
    };

    return {
      items,
      pageInfo,
    };
  },
};
