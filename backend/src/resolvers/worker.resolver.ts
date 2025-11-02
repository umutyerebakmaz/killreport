import { Resolvers } from '../generated-types';
import { getAllQueueStats } from '../services/rabbitmq';

/**
 * Worker Status Resolver
 * Provides real-time monitoring of background workers and queues
 */
export const workerResolvers: Resolvers = {
    Query: {
        workerStatus: async () => {
            const queues = await getAllQueueStats();

            // Consider system healthy if at least one worker is active
            const healthy = queues.some(q => q.active);

            return {
                timestamp: new Date().toISOString(),
                queues,
                healthy,
            };
        },
    },

    Subscription: {
        workerStatusUpdates: {
            subscribe: async function* () {
                // Emit status updates every 5 seconds
                while (true) {
                    const queues = await getAllQueueStats();
                    const healthy = queues.some(q => q.active);

                    yield {
                        workerStatusUpdates: {
                            timestamp: new Date().toISOString(),
                            queues,
                            healthy,
                        },
                    };

                    // Wait 5 seconds before next update
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            },
        },
    },
};
