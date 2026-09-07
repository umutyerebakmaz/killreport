import { QueryResolvers } from '@generated-types';
import prisma from '@services/prisma';

/**
 * Faction Query Resolvers
 * Handles fetching faction data
 */
export const factionQueries: QueryResolvers = {
  faction: async (_, { id }) => {
    const faction = await prisma.faction.findUnique({
      where: { id: Number(id) },
    });
    if (!faction) return null;
    return faction;
  },

  factions: async () => {
    return prisma.faction.findMany({
      orderBy: { name: 'asc' },
    });
  },
};
