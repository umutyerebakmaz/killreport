/**
 * Redis Service Aliases
 *
 * Provides convenient aliases for Redis services to avoid confusion
 */

// Main Redis client for general use (response caching, etc.)
export { default as redis } from './redis-cache';

// Default export is the cache Redis client
export { default } from './redis-cache';

/**
 * Usage:
 *
 * import redis from '../services/redis';           // For cache operations
 * import { redis } from '../services/redis';       // Also for cache operations
 *
 * For worker-specific Redis (different connection pool):
 * import redisWorker from '../services/redis-worker';
 */
