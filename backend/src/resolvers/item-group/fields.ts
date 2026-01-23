import { ItemGroupResolvers } from '@generated-types';

/**
 * ItemGroup Field Resolvers
 * Handles nested fields and computed properties for ItemGroup
 * Uses DataLoaders to prevent N+1 queries
 */
export const itemGroupFields: ItemGroupResolvers = {
    category: async (parent, _, context) => {
        // Cast to any to access Prisma model fields
        const prismaGroup = parent as any;
        // DataLoader ile N+1 problem'ini çöz
        const category = await context.loaders.category.load(prismaGroup.category_id);
        if (!category) return null;

        return {
            ...category,
            created_at: category.created_at.toISOString(),
            updated_at: category.updated_at.toISOString(),
        } as any;
    },

    types: async (parent, _, context) => {
        // Use DataLoader to batch types by group queries
        const types = await context.loaders.typesByGroup.load(parent.id);

        return types.map((t: any) => ({
            ...t,
            created_at: t.created_at.toISOString(),
            updated_at: t.updated_at.toISOString(),
        }));
    },
};
