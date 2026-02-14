import { SubscriptionResolvers } from '@generated-types';
import prisma from '@services/prisma';
import { pubsub } from '@services/pubsub';

/**
 * Killmail Subscription Resolvers
 * Handles real-time killmail updates via GraphQL subscriptions
 */
export const killmailSubscriptions: SubscriptionResolvers = {
    newKillmail: {
        subscribe: () => {
            console.log('🔔 Client subscribed to NEW_KILLMAIL');
            return pubsub.subscribe('NEW_KILLMAIL');
        },
        resolve: async (payload: { killmailId: number }) => {
            console.log('📨 Resolving NEW_KILLMAIL for killmail_id:', payload.killmailId);

            // Fetch only killmail data - field resolvers will handle relations
            const killmail = await prisma.killmail.findUnique({
                where: { killmail_id: payload.killmailId },
            });

            if (!killmail) {
                console.error('❌ Killmail not found:', payload.killmailId);
                return null;
            }

            // Field resolvers will populate victim, attackers, items via DataLoaders
            return {
                id: killmail.killmail_id.toString(),
                killmailHash: killmail.killmail_hash,
                killmailTime: killmail.killmail_time.toISOString(),
                solarSystemId: killmail.solar_system_id,
                createdAt: killmail.created_at.toISOString(),
                totalValue: (killmail as any).total_value,
                destroyedValue: (killmail as any).destroyed_value,
                droppedValue: (killmail as any).dropped_value,
                attackerCount: (killmail as any).attacker_count ?? 0,
            } as any;
        },
    },
};
