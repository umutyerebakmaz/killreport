/**
 * GraphQL Rate Limiting Plugin
 * Prevents abuse by limiting requests per IP/user
 */

import { Plugin } from 'graphql-yoga';
import logger from '../services/logger';
import { redisCache } from '../services/redis-cache';

interface RateLimitConfig {
  /** Maximum requests per window */
  max: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Key prefix for Redis */
  keyPrefix: string;
}

/**
 * Default rate limit configuration
 */
const DEFAULT_CONFIG: RateLimitConfig = {
  max: 100, // 100 requests
  windowMs: 60_000, // per minute
  keyPrefix: 'ratelimit',
};

/**
 * Extract identifier from request (user ID or IP)
 */
function getIdentifier(request: any): string {
  // Prefer user ID from authorization token
  const auth = request?.headers?.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    return `user:${auth.slice(7, 15)}`; // First 8 chars of token
  }

  // Fallback to IP address
  const forwarded = request?.headers?.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() :
    request?.headers?.get('x-real-ip') || 'unknown';

  return `ip:${ip}`;
}

/**
 * Create rate limiting plugin
 */
export function createRateLimitPlugin(config: Partial<RateLimitConfig> = {}): Plugin {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return {
    async onRequest({ request, fetchAPI, endResponse }) {
      try {
        // Skip rate limiting for SSE subscriptions
        const accept = request.headers.get('accept');
        if (accept?.includes('text/event-stream')) {
          logger.debug('⏭️  Skipping rate limit for SSE subscription');
          return;
        }

        const identifier = getIdentifier(request);
        const key = `${finalConfig.keyPrefix}:${identifier}`;

        // Get current count
        const current = await redisCache.get(key);
        const count = current ? parseInt(current, 10) : 0;

        // Check if limit exceeded
        if (count >= finalConfig.max) {
          const ttl = await redisCache.ttl(key);
          const resetIn = Math.ceil(ttl || finalConfig.windowMs / 1000);

          logger.warn(`🚫 Rate limit exceeded: ${identifier} (${count}/${finalConfig.max})`);

          // Return 429 response with all headers
          const response = new fetchAPI.Response(
            JSON.stringify({
              errors: [
                {
                  message: `Rate limit exceeded. Try again in ${resetIn} seconds.`,
                  extensions: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    retryAfter: resetIn,
                    limit: finalConfig.max,
                    windowMs: finalConfig.windowMs,
                  },
                },
              ],
            }),
            {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': String(resetIn),
                'X-RateLimit-Limit': String(finalConfig.max),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(Date.now() + resetIn * 1000),
              },
            }
          );

          endResponse(response);
          return;
        }

        // Increment counter
        const newCount = count + 1;
        const windowSeconds = Math.ceil(finalConfig.windowMs / 1000);

        if (count === 0) {
          // First request in window - set with TTL
          await redisCache.setex(key, windowSeconds, String(newCount));
        } else {
          // Subsequent request - increment
          await redisCache.incr(key);
        }

        // Calculate remaining and reset time
        const remaining = Math.max(0, finalConfig.max - newCount);
        const ttl = await redisCache.ttl(key);
        const resetTime = Date.now() + (ttl || windowSeconds) * 1000;

        logger.debug(`✅ Rate limit: ${identifier} (${newCount}/${finalConfig.max})`);

        // Store rate limit info on request for later
        (request as any).__rateLimit = {
          limit: finalConfig.max,
          remaining,
          reset: resetTime,
        };

      } catch (error) {
        // Fail open - don't block requests if Redis is down
        logger.error('Rate limit error (failing open):', error);
      }
    },

    async onResponse({ request, response }) {
      // Skip adding headers for SSE subscriptions
      const accept = request.headers.get('accept');
      if (accept?.includes('text/event-stream')) {
        return;
      }

      // Add rate limit headers to successful responses
      const rateLimitData = (request as any).__rateLimit;

      if (rateLimitData) {
        response.headers.set('X-RateLimit-Limit', String(rateLimitData.limit));
        response.headers.set('X-RateLimit-Remaining', String(rateLimitData.remaining));
        response.headers.set('X-RateLimit-Reset', String(rateLimitData.reset));
      }
    },
  };
}
