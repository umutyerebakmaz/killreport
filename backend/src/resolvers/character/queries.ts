import { PageInfo, QueryResolvers } from '@generated-types';
import prisma from '@services/prisma';
import redis from '@services/redis';

/**
 * Character Query Resolvers
 * Handles fetching character data and listing characters with filters
 */
export const characterQueries: QueryResolvers = {
  character: async (_, { id }) => {
    const cacheKey = `character:detail:${id}`;

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const character = await prisma.character.findUnique({
      where: { id: Number(id) },
    });
    if (!character) return null;

    const result = {
      ...character,
      birthday: character.birthday.toISOString(),
    } as any;

    // Cache for 30 minutes (character info updates occasionally)
    await redis.setex(cacheKey, 1800, JSON.stringify(result));
    return result;
  },

  characters: async (_, { filter }) => {
    const take = filter?.limit ?? 25;
    const currentPage = filter?.page ?? 1;
    const skip = (currentPage - 1) * take;

    // Filter koşullarını oluştur
    const where: any = {};
    if (filter) {
      if (filter.search) {
        // Normalize search: trim and replace multiple spaces with single space
        const normalizedSearch = filter.search.trim().replace(/\s+/g, ' ');
        where.name = { startsWith: normalizedSearch, mode: 'insensitive' };
      }
      if (filter.name) {
        // Normalize name: trim and replace multiple spaces with single space
        const normalizedName = filter.name.trim().replace(/\s+/g, ' ');
        where.name = { startsWith: normalizedName, mode: 'insensitive' };
      }
      if (filter.corporation_id) {
        where.corporation_id = filter.corporation_id;
      }
      if (filter.alliance_id) {
        where.alliance_id = filter.alliance_id;
      }
    }

    // Total record count (filtered)
    const totalCount = await prisma.character.count({ where });
    console.log('[DEBUG] Character query found:', totalCount, 'results for where:', JSON.stringify(where));
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
        case 'securityStatusAsc':
          orderBy = { security_status: 'asc' };
          break;
        case 'securityStatusDesc':
          orderBy = { security_status: 'desc' };
          break;
        default:
          orderBy = { name: 'asc' };
      }
    }

    // Fetch data
    const characters = await prisma.character.findMany({
      where,
      skip,
      take,
      orderBy,
    });

    const pageInfo: PageInfo = {
      currentPage,
      totalPages,
      totalCount,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    };

    return {
      edges: characters.map((c: any, index: number) => ({
        node: {
          ...c,
          birthday: c.birthday.toISOString(),
        },
        cursor: Buffer.from(`${skip + index}`).toString('base64'),
      })),
      pageInfo,
    };
  },
};
