import { PageInfo, QueryResolvers } from '@generated-types';
import prisma from '@services/prisma';
import redis from '@services/redis';

/**
 * Category Query Resolvers
 * Handles fetching category data and listing categories with filters
 */
export const categoryQueries: QueryResolvers = {
  category: async (_, { id }) => {
    const cacheKey = `category:detail:${id}`;

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const category = await prisma.category.findUnique({
      where: { id: Number(id) },
    });
    if (!category) return null;

    const result = {
      ...category,
      created_at: category.created_at.toISOString(),
      updated_at: category.updated_at.toISOString(),
    } as any;

    // Cache for 24 hours (category data rarely changes)
    await redis.setex(cacheKey, 86400, JSON.stringify(result));
    return result;
  },

  categories: async (_, { filter }) => {
    const take = filter?.limit ?? 25;
    const currentPage = filter?.page ?? 1;
    const skip = (currentPage - 1) * take;

    // Filter koşullarını oluştur
    const where: any = {};
    if (filter) {
      if (filter.search) {
        where.name = { contains: filter.search, mode: 'insensitive' };
      }
      if (filter.published !== undefined && filter.published !== null) {
        where.published = filter.published;
      }
    }

    // Total record count (filtered)
    const totalCount = await prisma.category.count({ where });
    const totalPages = Math.ceil(totalCount / take);

    // Fetch data - alfabetik sıralama
    const categories = await prisma.category.findMany({
      where,
      skip,
      take,
      orderBy: { name: 'asc' },
    });

    const pageInfo: PageInfo = {
      currentPage,
      totalPages,
      totalCount,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    };

    return {
      edges: categories.map((c: any, index: number) => ({
        node: {
          ...c,
          created_at: c.created_at.toISOString(),
          updated_at: c.updated_at.toISOString(),
        },
        cursor: Buffer.from(`${skip + index}`).toString('base64'),
      })),
      pageInfo,
    };
  },
};
