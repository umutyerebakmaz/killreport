import { MutationResolvers } from '@generated-types';
import { users } from './queries';

/**
 * User Mutation Resolvers
 * Handles operations that modify user data
 */
export const userMutations: MutationResolvers = {
    createUser: (_, { input }) => {
        const newUser = {
            id: String(users.length + 1),
            name: input.name,
            email: input.email,
            createdAt: new Date().toISOString(),
        };
        users.push(newUser);
        return {
            user: newUser,
            clientMutationId: input.clientMutationId || null,
        };
    },

    updateUser: (_, { input }) => {
        const user = users.find(u => u.id === input.id);
        if (!user) {
            return {
                user: null,
                clientMutationId: input.clientMutationId || null,
            };
        }

        if (input.name) user.name = input.name;
        if (input.email) user.email = input.email;

        return {
            user,
            clientMutationId: input.clientMutationId || null,
        };
    },
};
