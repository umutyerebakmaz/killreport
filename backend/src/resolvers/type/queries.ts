import { PageInfo, QueryResolvers } from '@generated-types';
import prisma from '@services/prisma';
import redis from '@services/redis';

/**
 * Type Query Resolvers
 * Handles fetching type (item) data and listing types with filters
 */
export const typeQueries: QueryResolvers = {
  type: async (_, { id }) => {
    const cacheKey = `type:detail:${id}`;

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const type = await prisma.type.findUnique({
      where: { id: Number(id) },
    });
    if (!type) return null;

    const result = {
      ...type,
      created_at: type.created_at.toISOString(),
      updated_at: type.updated_at.toISOString(),
    } as any;

    // Cache for 24 hours (type data rarely changes)
    await redis.setex(cacheKey, 86400, JSON.stringify(result));
    return result;
  },

  types: async (_, { filter }) => {
    const take = filter?.limit ?? 25;
    const currentPage = filter?.page ?? 1;
    const skip = (currentPage - 1) * take;

    // Filter koşullarını oluştur
    const where: any = {};
    if (filter) {
      if (filter.name) {
        where.name = { contains: filter.name, mode: 'insensitive' };
      }

      // Group filtering: merge groupList and categoryList
      const allGroupIds: number[] = [];

      if (filter.groupList !== undefined && filter.groupList !== null && filter.groupList.length > 0) {
        allGroupIds.push(...filter.groupList);
      }

      if (filter.categoryList !== undefined && filter.categoryList !== null && filter.categoryList.length > 0) {
        // İlk önce category_id'lere göre item_groups'tan group_id'leri al
        const groups = await prisma.itemGroup.findMany({
          where: { category_id: { in: filter.categoryList } },
          select: { id: true },
        });
        const groupIds = groups.map(g => g.id);
        allGroupIds.push(...groupIds);
      }

      if (allGroupIds.length > 0) {
        where.group_id = { in: [...new Set(allGroupIds)] }; // Remove duplicates
      }

      if (filter.group_id !== undefined && filter.group_id !== null) {
        where.group_id = filter.group_id;
      }
      if (filter.published !== undefined && filter.published !== null) {
        where.published = filter.published;
      }
    }

    // Total record count (filtered)
    const totalCount = await prisma.type.count({ where });
    const totalPages = Math.ceil(totalCount / take);

    // Fetch data - alfabetik sıralama
    const types = await prisma.type.findMany({
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
      edges: types.map((t: any, index: number) => ({
        node: {
          ...t,
          created_at: t.created_at.toISOString(),
          updated_at: t.updated_at.toISOString(),
        },
        cursor: Buffer.from(`${skip + index}`).toString('base64'),
      })),
      pageInfo,
    };
  },
};
