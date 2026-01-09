import { CategoryResolvers } from '@generated-types';

/**
 * Category Field Resolvers
 * Handles nested fields and computed properties for Category
 * Uses DataLoaders to prevent N+1 queries
 */
export const categoryFields: CategoryResolvers = {
  groups: async (parent, _, context) => {
    // DataLoader ile N+1 problem'ini çöz
    const groups = await context.loaders.itemGroupsByCategory.load(parent.id);

    return groups.map((g: any) => ({
      ...g,
      created_at: g.created_at.toISOString(),
      updated_at: g.updated_at.toISOString(),
    }));
  },
};
