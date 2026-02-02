/**
 * Redis Cache Service for Response Caching
 * Separate from main Redis instance for better isolation
 */

import Redis from 'ioredis';
import { REDIS_CONFIG } from '../config/cache';
import logger from './logger';

/**
 * Redis client specifically for response caching
 * Separate from the main Redis instance used for other purposes
 */
export const redisCache = new Redis(REDIS_CONFIG.url, {
    ...REDIS_CONFIG,
    reconnectOnError: (err) => {
        logger.error('Redis cache connection error:', err.message);
        return true; // Always try to reconnect
    },
});

// Handle connection events
redisCache.on('connect', () => {
    logger.info('✅ Redis cache connected');
});

redisCache.on('ready', () => {
    logger.debug('Redis cache ready');
});

redisCache.on('error', (err) => {
    logger.error('❌ Redis cache error:', err.message);
});

redisCache.on('close', () => {
    logger.warn('⚠️  Redis cache connection closed');
});

redisCache.on('reconnecting', (time: number) => {
    logger.info(`🔄 Redis cache reconnecting in ${time}ms...`);
});

// Initialize connection
redisCache.connect().catch(err => {
    logger.error('❌ Redis cache initial connection failed:', err);
});

export default redisCache;
