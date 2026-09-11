import { RegionResolvers } from '@generated-types';

/**
 * Region Field Resolvers
 * Handles nested fields and computed properties for Region
 * Uses DataLoaders to prevent N+1 queries
 */
export const regionFields: RegionResolvers = {
  constellations: async (parent, _, context) => {
    if (!parent.id) return [];
    return context.loaders.constellationsByRegion.load(parent.id);
  },
  constellationCount: async (parent, _, context) => {
    if (!parent.id) return 0;
    // Use DataLoader to batch region stats queries
    const stats = await context.loaders.regionStats.load(parent.id);
    return stats.constellationCount;
  },
  solarSystemCount: async (parent, _, context) => {
    if (!parent.id) return 0;
    // Use DataLoader to batch region stats queries
    const stats = await context.loaders.regionStats.load(parent.id);
    return stats.solarSystemCount;
  },
  sovereignty: async (parent, _, context) => {
    if (!parent.id) return null;
    return context.loaders.regionSovereignty.load(parent.id);
  },
};
