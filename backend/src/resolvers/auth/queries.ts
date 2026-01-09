import { QueryResolvers } from '@generated-types';
import prisma from '@services/prisma';

/**
 * Auth Query Resolvers
 * Handles authentication-related queries
 */
export const authQueries: QueryResolvers = {
    me: async (_parent, _args, context: any) => {
        if (!context.user) {
            throw new Error('Not authenticated');
        }

        // Get user info from database
        const user = await prisma.user.findUnique({
            where: { character_id: context.user.characterId },
        });

        if (!user) {
            throw new Error('User not found');
        }

        return {
            id: user.character_id.toString(),
            name: user.character_name,
            email: user.email || '',
            createdAt: user.created_at.toISOString(),
        };
    },
};
