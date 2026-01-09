import redis from '@services/redis';

/**
 * Analytics Helper Functions
 * Shared utilities for tracking and retrieving analytics data
 */

const ACTIVE_USER_TTL = 300; // 5 minutes
const ACTIVE_USERS_KEY_PREFIX = 'active:user:';

/**
 * Track a user as active
 * Each user gets a key with TTL of 5 minutes (300 seconds)
 * If user is active, we refresh the TTL
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
