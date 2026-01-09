import { BloodlineResolvers } from '@generated-types';

/**
 * Bloodline Field Resolvers
 * Handles nested fields for Bloodline type
 * Uses DataLoaders to prevent N+1 queries
 */
export const bloodlineFields: BloodlineResolvers = {
  race: async (parent: any, _, context) => {
    if (!parent.race_id) return null;
    return context.loaders.race.load(parent.race_id);
  },
};
