import { FactionResolvers } from '@generated-types';
import * as FactionStatsService from '@services/faction/faction-stats.service';

/**
 * Loads a corporation by id, or null without touching the loader when the
 * id is null: DataLoader.load() throws on a null key. A faction's
 * corporation is often an NPC corporation that is not in the database, and
 * the loader answers null for those too.
 */
async function loadCorporation(context: any, id: number | null | undefined) {
  if (!id) return null;
  const corporation = await context.loaders.corporation.load(id);
  if (!corporation) return null;
  return {
    ...corporation,
    date_founded: corporation.date_founded?.toISOString() || null,
  };
}

/**
 * Faction Field Resolvers
 * Maps Prisma's snake_case columns to GraphQL's camelCase fields, follows
 * relations through DataLoaders and delegates counters to the stats service.
 */
export const factionFields: FactionResolvers = {
  // Map Prisma's corporation_id (snake_case) to GraphQL's corporationId
  corporationId: (parent) => {
    const prismaParent = parent as any;
    return prismaParent.corporation_id ?? null;
  },

  // Map Prisma's militia_corporation_id (snake_case) to GraphQL's militiaCorporationId
  militiaCorporationId: (parent) => {
    const prismaParent = parent as any;
    return prismaParent.militia_corporation_id ?? null;
  },

  stationCount: (parent) => (parent as any).station_count ?? null,

  stationSystemCount: (parent) => (parent as any).station_system_count ?? null,

  solarSystem: async (parent, _args, context) => {
    const id = (parent as any).solar_system_id;
    if (!id) return null;
    return context.loaders.solarSystem.load(id);
  },

  corporation: (parent, _args, context) =>
    loadCorporation(context, (parent as any).corporation_id),

  militiaCorporation: (parent, _args, context) =>
    loadCorporation(context, (parent as any).militia_corporation_id),

  memberCorporationCount: (parent) =>
    FactionStatsService.getMemberCorporationCount(parent.id),

  memberCharacterCount: (parent) =>
    FactionStatsService.getMemberCharacterCount(parent.id),

  sovereigntySystemCount: (parent) =>
    FactionStatsService.getSovereigntySystemCount(parent.id),
};
