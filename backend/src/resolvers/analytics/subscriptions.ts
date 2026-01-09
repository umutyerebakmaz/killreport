import { SubscriptionResolvers } from '@generated-types';
import { getActiveUsersCount } from './helpers';

/**
 * Analytics Subscription Resolvers
 * Handles real-time analytics data streams
 */
export const analyticsSubscriptions: SubscriptionResolvers = {
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
};
