import { PageInfo, QueryResolvers } from '@generated-types';
import prisma from '@services/prisma';
import redis from '@services/redis';

/**
 * ItemGroup Query Resolvers
 * Handles fetching item group data and listing item groups with filters
 */
export const itemGroupQueries: QueryResolvers = {
    itemGroup: async (_, { id }) => {
        const cacheKey = `itemGroup:detail:${id}`;

        // Check cache first
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }

        const itemGroup = await prisma.itemGroup.findUnique({
            where: { id: Number(id) },
        });
        if (!itemGroup) return null;

        const result = {
            ...itemGroup,
            created_at: itemGroup.created_at.toISOString(),
            updated_at: itemGroup.updated_at.toISOString(),
        } as any;

        // Cache for 24 hours (item group data rarely changes)
        await redis.setex(cacheKey, 86400, JSON.stringify(result));
        return result;
    },

    itemGroups: async (_, { filter }) => {
        const take = filter?.limit ?? 25;
        const currentPage = filter?.page ?? 1;
        const skip = (currentPage - 1) * take;

        // Filter koşullarını oluştur
        const where: any = {};
        if (filter) {
            if (filter.search) {
                where.name = { contains: filter.search, mode: 'insensitive' };
            }
            if (filter.category_id !== undefined && filter.category_id !== null) {
                where.category_id = filter.category_id;
            }
            if (filter.published !== undefined && filter.published !== null) {
                where.published = filter.published;
            }
        }

        // Total record count (filtered)
        const totalCount = await prisma.itemGroup.count({ where });
        const totalPages = Math.ceil(totalCount / take);

        // Fetch data - alfabetik sıralama
        const itemGroups = await prisma.itemGroup.findMany({
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
            items: itemGroups.map((g: any) => ({
                ...g,
                created_at: g.created_at.toISOString(),
                updated_at: g.updated_at.toISOString(),
            })),
            pageInfo,
        };
    },
};
