import { createPubSub } from 'graphql-yoga';

// PubSub event types
export type PubSubChannels = {
    'NEW_KILLMAIL': [{ killmailId: number }];
};

// Create a singleton PubSub instance
export const pubsub = createPubSub<PubSubChannels>();
