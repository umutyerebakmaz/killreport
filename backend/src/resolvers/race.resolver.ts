import { QueryResolvers } from '@generated-types';
import prisma from '../services/prisma';

/**
 * Race Query Resolvers
 * Handles fetching race data
 */
export const raceQueries: QueryResolvers = {
    race: async (_, { id }) => {
        const race = await prisma.race.findUnique({
            where: { id: Number(id) },
        });
        return race;
    },

    races: async () => {
        const races = await prisma.race.findMany({
            orderBy: { name: 'asc' },
        });
        return races;
    },
};
