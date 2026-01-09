import { Resolvers } from '@generated-types';
import redis from '../services/redis';

/**
 * Track active users using Redis
 * Each user gets a key with TTL of 5 minutes (300 seconds)
 * If user is active, we refresh the TTL
 */

const ACTIVE_USER_TTL = 300; // 5 minutes
const ACTIVE_USERS_KEY_PREFIX = 'active:user:';

/**
 * Track a user as active
 */
export async function trackActiveUser(userId?: string, sessionId?: string) {
  const identifier = userId || sessionId;
  if (!identifier) return;

  const key = `${ACTIVE_USERS_KEY_PREFIX}${identifier}`;
  await redis.setex(key, ACTIVE_USER_TTL, Date.now().toString());
}

/**
 * Get count of active users
 */
export async function getActiveUsersCount(): Promise<number> {
  const keys = await redis.keys(`${ACTIVE_USERS_KEY_PREFIX}*`);
  return keys.length;
}

/**
 * Analytics Resolvers
 */
export const analyticsResolvers: Resolvers = {
  Query: {
    activeUsersCount: async () => {
      return await getActiveUsersCount();
    },
  },

  Subscription: {
    activeUsersUpdates: {
      subscribe: async function* () {
        // Emit active user count every 3 seconds
        while (true) {
          const count = await getActiveUsersCount();

          yield {
            activeUsersUpdates: {
              count,
              timestamp: new Date().toISOString(),
            },
          };

          // Wait 3 seconds before next update
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      },
    },
  },
};
