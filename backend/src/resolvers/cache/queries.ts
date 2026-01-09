import { QueryResolvers } from '@generated-types';
import logger from '@services/logger';
import CacheManager from '@utils/cache-manager';

/**
 * Cache Query Resolvers
 * Handles cache statistics and monitoring
 */
export const cacheQueries: QueryResolvers = {
  cacheStats: async () => {
    try {
      const stats = await CacheManager.getStats();
      const memoryUsage = await CacheManager.getMemoryUsage();
      const isHealthy = await CacheManager.healthCheck();

      return {
        ...stats,
        memoryUsage,
        isHealthy,
      };
    } catch (error) {
      logger.error('Error fetching cache stats:', error);
      throw new Error('Failed to fetch cache statistics');
    }
  },
};
