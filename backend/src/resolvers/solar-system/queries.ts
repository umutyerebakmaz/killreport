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
    const systems = await prisma.solarSystem.findMany({
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
      edges: systems.map((s: any, index: number) => ({
        node: s,
        cursor: Buffer.from(`${skip + index}`).toString('base64'),
      })),
      pageInfo,
    };
  },
};
