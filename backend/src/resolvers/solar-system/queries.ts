import { PageInfo, QueryResolvers } from '@generated-types';
import prisma from '@services/prisma';

/**
 * SolarSystem Query Resolvers
 * Handles fetching solar system data and listing systems with filters
 */
export const solarSystemQueries: QueryResolvers = {
    solarSystem: async (_, { id }) => {
        const system = await prisma.solarSystem.findUnique({
            where: { id: Number(id) },
        });
        return system as any;
    }, solarSystems: async (_, { filter }) => {
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
                where.constellation = {
                    region_id: filter.region_id
                };
            }
            if (filter.constellation_id) {
                where.constellation_id = filter.constellation_id;
            }
            if (filter.securityStatusMin !== undefined || filter.securityStatusMax !== undefined) {
                where.security_status = {};
                if (filter.securityStatusMin !== undefined) {
                    where.security_status.gte = filter.securityStatusMin;
                }
                if (filter.securityStatusMax !== undefined) {
                    where.security_status.lte = filter.securityStatusMax;
                }
            }
        }

        // Total record count (filtered)
        const totalCount = await prisma.solarSystem.count({ where });
        const totalPages = Math.ceil(totalCount / take);

        // OrderBy logic
        let orderBy: any = { name: 'asc' }; // default
        let useRawQuery = false;
        let orderByField = '';
        let orderByDirection: 'ASC' | 'DESC' = 'ASC';

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
                case 'shipKillsDesc':
                    useRawQuery = true;
                    orderByField = 'ship_kills';
                    orderByDirection = 'DESC';
                    break;
                case 'shipKillsAsc':
                    useRawQuery = true;
                    orderByField = 'ship_kills';
                    orderByDirection = 'ASC';
                    break;
                case 'podKillsDesc':
                    useRawQuery = true;
                    orderByField = 'pod_kills';
                    orderByDirection = 'DESC';
                    break;
                case 'podKillsAsc':
                    useRawQuery = true;
                    orderByField = 'pod_kills';
                    orderByDirection = 'ASC';
                    break;
                case 'npcKillsDesc':
                    useRawQuery = true;
                    orderByField = 'npc_kills';
                    orderByDirection = 'DESC';
                    break;
                case 'npcKillsAsc':
                    useRawQuery = true;
                    orderByField = 'npc_kills';
                    orderByDirection = 'ASC';
                    break;
                default:
                    orderBy = { name: 'asc' };
            }
        }

        let systems;

        // For kill-based sorting, we need to join with system_kills table
        if (useRawQuery) {
            // Build WHERE clause for raw query
            const whereConditions: string[] = [];
            const whereParams: any[] = [];
            let paramIndex = 1;

            if (filter?.search) {
                whereConditions.push(`ss.name ILIKE $${paramIndex}`);
                whereParams.push(`%${filter.search}%`);
                paramIndex++;
            }
            if (filter?.name) {
                whereConditions.push(`ss.name ILIKE $${paramIndex}`);
                whereParams.push(`%${filter.name}%`);
                paramIndex++;
            }
            if (filter?.constellation_id) {
                whereConditions.push(`ss.constellation_id = $${paramIndex}`);
                whereParams.push(filter.constellation_id);
                paramIndex++;
            }
            if (filter?.region_id) {
                whereConditions.push(`c.region_id = $${paramIndex}`);
                whereParams.push(filter.region_id);
                paramIndex++;
            }
            if (filter?.securityStatusMin !== undefined) {
                whereConditions.push(`ss.security_status >= $${paramIndex}`);
                whereParams.push(filter.securityStatusMin);
                paramIndex++;
            }
            if (filter?.securityStatusMax !== undefined) {
                whereConditions.push(`ss.security_status <= $${paramIndex}`);
                whereParams.push(filter.securityStatusMax);
                paramIndex++;
            }

            const whereClause = whereConditions.length > 0
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';

            // Raw query to get solar systems with latest kills, ordered by kill stats
            const query = `
                WITH latest_kills AS (
                    SELECT DISTINCT ON (system_id)
                        system_id,
                        ship_kills,
                        pod_kills,
                        npc_kills,
                        timestamp
                    FROM system_kills
                    ORDER BY system_id, timestamp DESC
                )
                SELECT ss.*
                FROM solar_systems ss
                LEFT JOIN constellations c ON ss.constellation_id = c.constellation_id
                LEFT JOIN latest_kills lk ON ss.system_id = lk.system_id
                ${whereClause}
                ORDER BY lk.${orderByField} ${orderByDirection} NULLS LAST, ss.name ASC
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;

            whereParams.push(take, skip);
            systems = await prisma.$queryRawUnsafe(query, ...whereParams);
        } else {
            // Standard Prisma query for non-kill-based sorting
            systems = await prisma.solarSystem.findMany({
                where,
                skip,
                take,
                orderBy,
            });
        }

        const pageInfo: PageInfo = {
            currentPage,
            totalPages,
            totalCount,
            hasNextPage: currentPage < totalPages,
            hasPreviousPage: currentPage > 1,
        };

        return {
            items: systems.map((s: any) => s),
            pageInfo,
        };
    },
};
