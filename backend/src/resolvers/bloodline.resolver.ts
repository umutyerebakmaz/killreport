import { BloodlineResolvers, QueryResolvers } from '../generated-types';
import prisma from '../services/prisma';

/**
 * Bloodline Query Resolvers
 * Handles fetching bloodline data
 */
export const bloodlineQueries: QueryResolvers = {
    bloodline: async (_, { id }) => {
        const bloodline = await prisma.bloodline.findUnique({
            where: { id: Number(id) },
        });
        return bloodline as any;
    },

    bloodlines: async () => {
        const bloodlines = await prisma.bloodline.findMany({
            orderBy: { name: 'asc' },
        });
        return bloodlines as any;
    },
};

/**
 * Bloodline Field Resolvers
 * Handles nested fields for Bloodline type
 * Uses DataLoaders to prevent N+1 queries
 */
export const bloodlineFieldResolvers: BloodlineResolvers = {
    race: async (parent: any, _, context) => {
        if (!parent.race_id) return null;
        return context.loaders.race.load(parent.race_id);
    },
};
