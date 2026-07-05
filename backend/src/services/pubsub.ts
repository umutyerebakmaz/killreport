import { createRedisEventTarget } from '@graphql-yoga/redis-event-target';
import { createPubSub } from 'graphql-yoga';
import Redis from 'ioredis';

// PubSub event types
export type SovereigntyAlertPayload = {
    type: 'campaign_started' | 'campaign_ended' | 'territory_change';
    systemId: number;
    defenderId?: number | null;
    outcome?: string | null;
    previousOwnerId?: number | null;
    newOwnerId?: number | null;
    changeType?: string | null;
};

export type PubSubChannels = {
    'NEW_KILLMAIL': [{ killmailId: number }];
    'SOVEREIGNTY_ALERT': [SovereigntyAlertPayload];
};

// Check if Redis is available for distributed PubSub
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const USE_REDIS = process.env.USE_REDIS_PUBSUB === 'true';

// Create PubSub instance
export const pubsub = USE_REDIS
    ? createPubSub<PubSubChannels>({
        eventTarget: createRedisEventTarget({
            publishClient: new Redis(REDIS_URL),
            subscribeClient: new Redis(REDIS_URL),
        })
    })
    : createPubSub<PubSubChannels>(); // In-memory fallback

console.log(`📡 PubSub: ${USE_REDIS ? 'Redis (distributed)' : 'In-memory (single process only)'}`);

