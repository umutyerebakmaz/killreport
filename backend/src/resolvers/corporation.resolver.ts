import { Corporation, CorporationConnection, CorporationResolvers, PageInfo, QueryResolvers } from '../generated-types';
import prisma from '../services/prisma';

export const corporationQueries: QueryResolvers = {
  corporation: async (_, { id }): Promise<Corporation | null> => {
    const corp = await prisma.corporation.findUnique({
      where: { id: Number(id) },
    });

    if (!corp) return null;

    return {
      ...corp,
      date_founded: corp.date_founded?.toISOString() || null,
      alliance: null, // Field resolver handles this
    };
  },

  corporations: async (_, { filter }): Promise<CorporationConnection> => {
    const page = filter?.page || 1;
    const limit = filter?.limit || 25;
    const skip = (page - 1) * limit;

    // Build where clause for filters
    const where: any = {};

    if (filter?.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { ticker: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    if (filter?.name) {
      where.name = { contains: filter.name, mode: 'insensitive' };
    }

    if (filter?.ticker) {
      where.ticker = { contains: filter.ticker, mode: 'insensitive' };
    }

    if (filter?.allianceId) {
      where.alliance_id = filter.allianceId;
    }

    if (filter?.dateFoundedFrom || filter?.dateFoundedTo) {
      where.date_founded = {};
      if (filter?.dateFoundedFrom) {
        where.date_founded.gte = new Date(filter.dateFoundedFrom);
      }
      if (filter?.dateFoundedTo) {
        where.date_founded.lte = new Date(filter.dateFoundedTo);
      }
    }

    const [corporations, totalCount] = await Promise.all([
      prisma.corporation.findMany({
        where,
        take: limit,
        skip,
        orderBy: { member_count: 'desc' },
      }),
      prisma.corporation.count({ where }),
    ]);

    const edges = corporations.map((corp: any) => ({
      node: {
        ...corp,
        date_founded: corp.date_founded?.toISOString() || null,
        alliance: null, // Field resolver handles this
      },
      cursor: Buffer.from(`${corp.id}`).toString('base64'),
    }));

    const totalPages = Math.ceil(totalCount / limit);

    const pageInfo: PageInfo = {
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      currentPage: page,
      totalPages,
      totalCount,
    };

    return {
      edges,
      pageInfo,
    };
  },
};

/**
 * Field Resolvers - Nested fields için lazy loading + DataLoader
 * Alliance bilgisi sadece query'de istenirse çekilir
 * DataLoader ile batch loading - N+1 problem çözümü
 */
export const corporationFieldResolvers: CorporationResolvers = {
  alliance: async (parent, _args, context) => {
    if (!parent.alliance_id) return null;

    // DataLoader kullan - otomatik batch yapacak
    const alliance = await context.loaders.alliance.load(parent.alliance_id);

    if (!alliance) return null;

    return {
      ...alliance,
      date_founded: alliance.date_founded.toISOString(),
      corporations: [], // Circular reference'ı önlemek için boş array
    };
  },
};
