import { PageInfo, QueryResolvers } from '@generated-types';
import prisma from '@services/prisma';
import redis from '@services/redis';

/**
 * Alliance Query Resolvers
 * Handles fetching alliance data and listing alliances with filters
 */
export const allianceQueries: QueryResolvers = {
  alliance: async (_, { id }) => {
    const cacheKey = `alliance:detail:${id}`;

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const alliance = await prisma.alliance.findUnique({
      where: { id: Number(id) },
    });
    if (!alliance) return null;

    // Field resolver'lar eksik field'ları otomatik doldurur
    const result = {
      ...alliance,
      date_founded: alliance.date_founded.toISOString(),
    } as any;

    // Cache for 30 minutes (alliance info updates occasionally)
    await redis.setex(cacheKey, 1800, JSON.stringify(result));
    return result;
  },

  alliances: async (_, { filter }) => {
    const take = filter?.limit ?? 25;
    const currentPage = filter?.page ?? 1;
    const skip = (currentPage - 1) * take;

    // Filter koşullarını oluştur
    const where: any = {};

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

    if (filter?.dateFoundedFrom || filter?.dateFoundedTo) {
      where.date_founded = {};
      if (filter.dateFoundedFrom) {
        where.date_founded.gte = new Date(filter.dateFoundedFrom);
      }

      if (filter.dateFoundedTo) {
        where.date_founded.lte = new Date(filter.dateFoundedTo);
      }
    }

    // Total record count (filtered)
    const totalCount = await prisma.alliance.count({ where });
    const totalPages = Math.ceil(totalCount / take);

    // OrderBy logic
    let orderBy: any = { name: 'asc' }; // default
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
        default:
          orderBy = { name: 'asc' };
      }
    }

    // Fetch data
    const alliances = await prisma.alliance.findMany({
      where,
      skip,
      take,
      orderBy,
      select: {
        id: true,
        name: true,
        ticker: true,
        date_founded: true,
        executor_corporation_id: true,
        creator_id: true,
        creator_corporation_id: true,
        faction_id: true,
        // Hesaplanmış field'ları seç
        member_count: true,
        corporation_count: true,
      },
    });

    const pageInfo: PageInfo = {
      currentPage,
      totalPages,
      totalCount,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    };

    return {
      edges: alliances.map((a: any, index: number) => ({
        node: {
          ...a,
          date_founded: a.date_founded.toISOString(),
          // Field resolver'lar metrics gibi computed field'ları otomatik doldurur
        },
        cursor: Buffer.from(`${skip + index}`).toString('base64'),
      })),
      pageInfo,
    };
  },
};
