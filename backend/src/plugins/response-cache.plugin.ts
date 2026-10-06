/**
 * GraphQL Response Cache Plugin Configuration
 */

import { useResponseCache } from '@envelop/response-cache';
import logger from '@services/logger';
import { redisCache } from '@services/redis-cache';
import {
  CACHE_TTL,
  MAX_CACHE_TTL_SECONDS,
  PUBLIC_CACHE_QUERIES,
  TTL_PER_SCHEMA_COORDINATE,
} from '@config/cache';
import { createHash } from 'node:crypto';

/**
 * Extract operation name from request
 */
function getOperationName(request: any): string {
  const body = request?.request?.body;
  if (body && typeof body === 'object' && 'operationName' in body) {
    return String(body.operationName || '');
  }
  return '';
}

/**
 * Create response cache plugin with Redis backend
 */
export function createResponseCachePlugin() {
  return useResponseCache({
    // Session-based cache key (per-user or public)
    session: (request) => {
      const operationName = getOperationName(request);

      // Public queries: Same cache for all users
      if (PUBLIC_CACHE_QUERIES.includes(operationName as any)) {
        return 'public';
      }

      // User-specific queries: Per-user cache
      const req = request as any;
      const auth =
        req?.request?.headers?.get('authorization') ||
        req?.request?.headers?.get('Authorization');

      if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
        // Hash the whole token rather than a prefix of it. Every EVE access
        // token is a JWT whose header serialises identically, so the first
        // few characters are the same for every logged-in user — keying on
        // a prefix put all authenticated users in one cache bucket.
        return createHash('sha256').update(auth.slice(7)).digest('hex');
      }

      return 'anonymous';
    },

    // Default TTL
    ttl: CACHE_TTL.DEFAULT_PUBLIC,

    // Specific TTL per schema coordinate
    ttlPerSchemaCoordinate: TTL_PER_SCHEMA_COORDINATE,

    // Include extension metadata for debugging
    includeExtensionMetadata: true,

    // Redis cache implementation
    cache: {
      get: async (key) => {
        try {
          const value = await redisCache.get(key);
          if (value) {
            logger.debug(`cache hit: ${key.substring(0, 50)}...`);
            return JSON.parse(value);
          }
          logger.debug(`cache miss: ${key.substring(0, 50)}...`);
          return null;
        } catch (error) {
          logger.error('cache get error:', error);
          return null;
        }
      },

      // useResponseCache calls set(id, data, entities, ttl). This used to
      // take three parameters, so the entity list arrived as `ttl`, was never
      // a number, and every response fell back to REDIS_DEFAULT — none of
      // TTL_PER_SCHEMA_COORDINATE ever applied.
      set: async (key, value, _entities, ttl) => {
        try {
          const ttlValue =
            typeof ttl === 'number' ? ttl : CACHE_TTL.REDIS_DEFAULT;

          // Convert to seconds
          const ttlInSeconds = Math.ceil(ttlValue / 1000);

          // Sanity check
          if (
            isNaN(ttlInSeconds) ||
            ttlInSeconds <= 0 ||
            ttlInSeconds > MAX_CACHE_TTL_SECONDS
          ) {
            logger.warn(`invalid TTL: ${ttlInSeconds}s, using default 60s`);
            await redisCache.setex(key, 60, JSON.stringify(value));
            return;
          }

          await redisCache.setex(key, ttlInSeconds, JSON.stringify(value));
          logger.debug(
            `cache set: ${key.substring(0, 50)}... (TTL: ${ttlInSeconds}s)`,
          );
        } catch (error) {
          logger.error('cache set error:', error);
        }
      },

      invalidate: async (entities) => {
        try {
          for (const entity of entities) {
            const pattern = `*${entity.typename}:${entity.id}*`;
            const keys = await redisCache.keys(pattern);
            if (keys.length > 0) {
              await redisCache.del(...keys);
              logger.info(
                `cache invalidated: ${entity.typename}:${entity.id} (${keys.length} keys)`,
              );
            }
          }
        } catch (error) {
          logger.error('cache invalidate error:', error);
        }
      },
    },

    // Only cache successful results
    shouldCacheResult: ({ result }) => {
      if (result.errors && result.errors.length > 0) {
        return false;
      }
      return true;
    },
  });
}
