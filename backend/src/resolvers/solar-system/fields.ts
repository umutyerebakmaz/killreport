import { SolarSystemResolvers } from '@generated-types';

/**
 * SolarSystem Field Resolvers
 * Handles nested fields and computed properties for SolarSystem
 * Uses DataLoaders to prevent N+1 queries
 */
export const solarSystemFields: SolarSystemResolvers = {
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
  constellation: async (parent, _, context) => {
    const prismaParent = parent as any;
    if (!prismaParent.constellation_id) return null;
    return context.loaders.constellation.load(prismaParent.constellation_id);
  },
};
