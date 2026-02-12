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
            updatedAt: character?.updated_at ? character.updated_at.toISOString() : new Date().toISOString(),
            birthday: character?.birthday ? character.birthday.toISOString() : null,
        } as any;
        console.log('xxxxx', result)
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
                // Trim Input: trim and replace multiple spaces with single space
                const trim = filter.search.trim().replace(/\s+/g, ' ');
                where.name = { startsWith: trim, mode: 'insensitive' };
            }

            if (filter.name) {
                // Trim Input: trim and replace multiple spaces with single space
                const trim = filter.name.trim().replace(/\s+/g, ' ');
                where.name = { startsWith: trim, mode: 'insensitive' };
            }

            if (filter.corporationId) {
                where.corporation_id = filter.corporationId;
            }

            if (filter.allianceId) {
                where.alliance_id = filter.allianceId;
            }

        }

        // Total record count (filtered)
        const totalCount = await prisma.character.count({ where });
        const totalPages = Math.ceil(totalCount / take);

        // orderBy
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
            items: characters.map((c: any) => ({
                ...c,
                updatedAt: c.updated_at ? c.updated_at.toISOString() : new Date().toISOString(),
                birthday: c.birthday ? c.birthday.toISOString() : null,
            })),
            pageInfo,
        };
    },
};
