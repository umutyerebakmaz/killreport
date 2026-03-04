import { ConstellationResolvers } from '@generated-types';

/**
 * Constellation Field Resolvers
 * Handles nested fields and computed properties for Constellation
 * Uses DataLoaders to prevent N+1 queries
 */
export const constellationFields: ConstellationResolvers = {
  position: (parent) => {
    // parent is from Prisma, has position_x, position_y, position_z
    const prismaParent = parent as any;
    if (prismaParent.position_x === null || prismaParent.position_y === null || prismaParent.position_z === null) {
      return null;
    }
    return {
      x: prismaParent.position_x,
      y: prismaParent.position_y,
      z: prismaParent.position_z,
    };
  },
  region: async (parent: any, _: any, context: any) => {
    const prismaParent = parent as any;
    if (!prismaParent.region_id) return null;
    return context.loaders.region.load(prismaParent.region_id);
  },
  solarSystems: async (parent: any, _: any, context: any) => {
    if (!parent.id) return [];
    return context.loaders.solarSystemsByConstellation.load(parent.id);
  },
  solarSystemCount: async (parent, _, context) => {
    if (!parent.id) return 0;
    // Use DataLoader to batch queries - prevents N+1
    const systems = await context.loaders.solarSystemsByConstellation.load(parent.id);
    return systems.length;
  },
  securityStats: async (parent, _, context) => {
    if (!parent.id) return { highSec: 0, lowSec: 0, nullSec: 0, wormhole: 0, avgSecurity: null };
    // Use optimized DataLoader to batch security stats queries
    return context.loaders.constellationSecurityStats.load(parent.id);
  },
};
