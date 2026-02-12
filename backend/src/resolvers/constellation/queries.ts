import { PageInfo, QueryResolvers } from '@generated-types';
import prisma from '@services/prisma';

/**
 * Constellation Query Resolvers
 * Handles fetching constellation data and listing constellations with filters
 */
export const constellationQueries: QueryResolvers = {
    constellation: async (_, { id }) => {
        const constellation = await prisma.constellation.findUnique({
            where: { id: Number(id) },
        });
        return constellation as any;
    },

    constellations: async (_, { filter }) => {
        const take = filter?.limit ?? 25;
        const currentPage = filter?.page ?? 1;
        const skip = (currentPage - 1) * take;

        // Filter koşullarını oluştur
        const where: any = {};
        if (filter) {
            if (filter.search) {
                where.name = { contains: filter.search, mode: 'insensitive' };
            }
            if (filter.name) {
                where.name = { contains: filter.name, mode: 'insensitive' };
            }
            if (filter.region_id) {
                where.region_id = filter.region_id;
            }
        }

        // Total record count (filtered)
        const totalCount = await prisma.constellation.count({ where });
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
                default:
                    orderBy = { name: 'asc' };
            }
        }

        // Fetch data
        const constellations = await prisma.constellation.findMany({
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
            items: constellations.map((c: any) => c),
            pageInfo,
        };
    },
};
