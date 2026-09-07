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
    return {
      ...faction,
      corporationId: faction.corporation_id,
      militiaCorporationId: faction.militia_corporation_id,
    };
  },

  factions: async () => {
    const factions = await prisma.faction.findMany({
      orderBy: { name: 'asc' },
    });
    return factions.map((faction) => ({
      ...faction,
      corporationId: faction.corporation_id,
      militiaCorporationId: faction.militia_corporation_id,
    }));
  },
};
