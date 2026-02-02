/**
 * GraphQL Response Cache Plugin Configuration
 */

import { useResponseCache } from '@envelop/response-cache';
import { CACHE_TTL, MAX_CACHE_TTL_SECONDS, PUBLIC_CACHE_QUERIES, TTL_PER_SCHEMA_COORDINATE } from '../config/cache';
import logger from '../services/logger';
import { redisCache } from '../services/redis-cache';

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
            const auth = req?.request?.headers?.get('authorization') ||
                req?.request?.headers?.get('Authorization');

            if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
                return auth.slice(7, 15); // First 8 chars of token
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
                        logger.debug(`Cache HIT: ${key.substring(0, 50)}...`);
                        return JSON.parse(value);
                    }
                    logger.debug(`Cache MISS: ${key.substring(0, 50)}...`);
                    return null;
                } catch (error) {
                    logger.error('Cache get error:', error);
                    return null;
                }
            },

            set: async (key, value, ttl) => {
                try {
                    // Handle TTL (can be number, Map iterator, or undefined)
                    let ttlValue = CACHE_TTL.REDIS_DEFAULT;

                    if (ttl !== undefined && ttl !== null) {
                        if (typeof ttl === 'object' && Symbol.iterator in Object(ttl)) {
                            // Extract from iterator
                            const iterator = ttl[Symbol.iterator]();
                            const first = iterator.next();
                            if (!first.done && typeof first.value === 'number') {
                                ttlValue = first.value;
                            }
                        } else if (typeof ttl === 'number') {
                            ttlValue = ttl;
                        }
                    }

                    // Convert to seconds
                    const ttlInSeconds = Math.ceil(ttlValue / 1000);

                    // Sanity check
                    if (isNaN(ttlInSeconds) || ttlInSeconds <= 0 || ttlInSeconds > MAX_CACHE_TTL_SECONDS) {
                        logger.warn(`Invalid TTL: ${ttlInSeconds}s, using default 60s`);
                        await redisCache.setex(key, 60, JSON.stringify(value));
                        return;
                    }

                    await redisCache.setex(key, ttlInSeconds, JSON.stringify(value));
                    logger.debug(`Cache SET: ${key.substring(0, 50)}... (TTL: ${ttlInSeconds}s)`);
                } catch (error) {
                    logger.error('Cache set error:', error);
                }
            },

            invalidate: async (entities) => {
                try {
                    for (const entity of entities) {
                        const pattern = `*${entity.typename}:${entity.id}*`;
                        const keys = await redisCache.keys(pattern);
                        if (keys.length > 0) {
                            await redisCache.del(...keys);
                            logger.info(`Cache invalidated: ${entity.typename}:${entity.id} (${keys.length} keys)`);
                        }
                    }
                } catch (error) {
                    logger.error('Cache invalidate error:', error);
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
