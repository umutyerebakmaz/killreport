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
    // Relations and counters are filled in by factionFields.
    return faction as any;
  },

  factions: async () => {
    const factions = await prisma.faction.findMany({
      // 500021 is ESI's placeholder faction, literally named "Unknown".
      where: { id: { not: 500021 } },
      orderBy: { name: 'asc' },
    });
    // Relations and counters are filled in by factionFields.
    return factions as any[];
  },
};
