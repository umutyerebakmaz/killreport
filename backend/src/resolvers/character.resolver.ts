import { CharacterResolvers, PageInfo, QueryResolvers } from '../generated-types';
import prisma from '../services/prisma';

export const characterQueries: QueryResolvers = {
  character: async (_, { id }) => {
    const character = await prisma.character.findUnique({
      where: { id: Number(id) },
    });
    if (!character) return null;

    return {
      ...character,
      birthday: character.birthday.toISOString(),
    } as any;
  },

  characters: async (_, { filter }) => {
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
      if (filter.corporation_id) {
        where.corporation_id = filter.corporation_id;
      }
      if (filter.alliance_id) {
        where.alliance_id = filter.alliance_id;
      }
    }

    // Total record count (filtered)
    const totalCount = await prisma.character.count({ where });
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

/**
 * Field Resolvers - Nested fields için lazy loading + DataLoader
 */
export const characterFieldResolvers: CharacterResolvers = {
  corporation: async (parent, _args, context) => {
    const corporation = await context.loaders.corporation.load(parent.corporation_id);
    if (!corporation) return null;

    return {
      ...corporation,
      date_founded: corporation.date_founded?.toISOString() || null,
    };
  },

  alliance: async (parent, _args, context) => {
    if (!parent.alliance_id) return null;

    const alliance = await context.loaders.alliance.load(parent.alliance_id);
    if (!alliance) return null;

    return {
      ...alliance,
      date_founded: alliance.date_founded.toISOString(),
    };
  },

  race: async (parent, _args, context) => {
    const race = await context.loaders.race.load(parent.race_id);
    return race || null;
  },

  bloodline: async (parent, _args, context) => {
    const bloodline = await context.loaders.bloodline.load(parent.bloodline_id);
    return bloodline || null;
  },
};
