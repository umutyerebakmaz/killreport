import { createRedisEventTarget } from '@graphql-yoga/redis-event-target';
import { createPubSub } from 'graphql-yoga';
import Redis from 'ioredis';

import { config } from '@config/config';

// PubSub event types
import type { SovereigntyAlertData } from '@services/sovereignty/alert-builder';

export type PubSubChannels = {
  NEW_KILLMAIL: [{ killmailId: number }];
  // Fully-hydrated alert built at publish time; the resolver is a passthrough.
  SOVEREIGNTY_ALERT: [SovereigntyAlertData];
};

// Read through config so .env is loaded before these are evaluated; see cache.ts.
const REDIS_URL = config.redis.url;
const USE_REDIS = config.redis.usePubSub;

// Create PubSub instance
export const pubsub = USE_REDIS
  ? createPubSub<PubSubChannels>({
      eventTarget: createRedisEventTarget({
        publishClient: new Redis(REDIS_URL),
        subscribeClient: new Redis(REDIS_URL),
      }),
    })
  : createPubSub<PubSubChannels>(); // In-memory fallback

console.log(
  `📡 PubSub: ${USE_REDIS ? 'Redis (distributed)' : 'In-memory (single process only)'}`,
);
