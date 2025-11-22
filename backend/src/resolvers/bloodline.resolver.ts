import { QueryResolvers } from '../generated-types';
import prisma from '../services/prisma';

export const bloodlineQueries: QueryResolvers = {
    bloodline: async (_, { id }) => {
        const bloodline = await prisma.bloodline.findUnique({
            where: { id: Number(id) },
        });
        return bloodline;
    },

    bloodlines: async () => {
        const bloodlines = await prisma.bloodline.findMany({
            orderBy: { name: 'asc' },
        });
        return bloodlines;
    },
};
