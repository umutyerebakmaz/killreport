import { Corporation, CorporationResolvers, QueryResolvers } from '../generated-types';
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
