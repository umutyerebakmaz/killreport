import { SubscriptionResolvers } from '@generated-types';
import { pubsub } from '@services/pubsub';
import type { SovereigntyAlertData } from '@services/sovereignty/alert-builder';

/**
 * Sovereignty Alert Subscription
 *
 * Streams sov events published by the worker processes (campaign started/ended,
 * territory change) to every connected browser over SSE. The payload is already
 * fully hydrated at publish time (see services/sovereignty/alert-builder.ts), so
 * this resolver is a passthrough — no per-subscriber DB work.
 */
export const sovereigntySubscriptions: SubscriptionResolvers = {
  sovereigntyAlert: {
    subscribe: () => pubsub.subscribe('SOVEREIGNTY_ALERT'),
    resolve: (payload: SovereigntyAlertData) => payload,
  },
};
