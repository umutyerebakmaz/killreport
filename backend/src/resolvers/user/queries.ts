import { QueryResolvers } from '@generated-types';

// Mock data - will come from database in real project
const users = [
    { id: '1', name: 'John Doe', email: 'john@example.com', createdAt: new Date().toISOString() },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', createdAt: new Date().toISOString() },
];

/**
 * User Query Resolvers
 * Handles fetching user data
 */
export const userQueries: QueryResolvers = {
    user: (_, { id }) => {
        const user = users.find(u => u.id === id);
        return user || null;
    },

    users: () => {
        return users;
    },
};

// Export users for use in mutations
export { users };
