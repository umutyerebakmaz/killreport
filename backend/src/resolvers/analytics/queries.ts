import { QueryResolvers } from '@generated-types';
import { getActiveUsersCount } from './helpers';

/**
 * Analytics Query Resolvers
 * Handles fetching analytics data
 */
export const analyticsQueries: QueryResolvers = {
  activeUsersCount: async () => {
    return await getActiveUsersCount();
  },
};
