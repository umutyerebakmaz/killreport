import { MutationResolvers, QueryResolvers } from '../generated-types';

// Mock data - will come from database in real project
const users = [
    { id: '1', name: 'John Doe', email: 'john@example.com', createdAt: new Date().toISOString() },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', createdAt: new Date().toISOString() },
];

// Query Resolvers
export const userQueries: QueryResolvers = {
    user: (_, { id }) => {
        const user = users.find(u => u.id === id);
        return user || null;
    },

    users: () => {
        return users;
    },
};

// Mutation Resolvers
export const userMutations: MutationResolvers = {
    createUser: (_, { input }) => {
        const newUser = {
            id: String(users.length + 1),
            name: input.name,
            email: input.email,
            createdAt: new Date().toISOString(),
        };
        users.push(newUser);
        return newUser;
    },

    updateUser: (_, { id, input }) => {
        const user = users.find(u => u.id === id);
        if (!user) return null;

        if (input.name) user.name = input.name;
        if (input.email) user.email = input.email;

        return user;
    },
};
