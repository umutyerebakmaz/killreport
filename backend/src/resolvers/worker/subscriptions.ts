import { SubscriptionResolvers } from '@generated-types';
import prisma from '@services/prisma';
import { getAllQueueStats } from '@services/rabbitmq';
import { CacheManager } from '@utils/cache-manager';
import { checkWorkerProcess, QUEUE_WORKER_MAP, STANDALONE_WORKERS } from './helpers';

/**
 * Get database size in MB
 */
async function getDatabaseSizeMB(): Promise<number> {
    try {
        // Get raw size in bytes - works on all PostgreSQL versions including managed services
        const result = await prisma.$queryRaw<Array<{ size: bigint }>>`
            SELECT pg_database_size(current_database()) as size
        `;

        if (result && result[0] && result[0].size) {
            // Convert bytes to MB (1 MB = 1024 * 1024 bytes)
            const sizeInBytes = Number(result[0].size);
            return sizeInBytes / (1024 * 1024);
        }
        return 0;
    } catch (error) {
        console.error('Error getting database size:', error);
        return 0;
    }
}

/**
 * Worker Subscription Resolvers
 * Provides real-time updates for worker and queue monitoring
 */
export const workerSubscriptions: SubscriptionResolvers = {
    workerStatusUpdates: {
        subscribe: async function* () {
            // Emit status updates every 5 seconds
            while (true) {
                const [queueStats, databaseSizeMB, redisMetrics] = await Promise.all([
                    getAllQueueStats(),
                    getDatabaseSizeMB(),
                    CacheManager.getRedisMetrics(),
                ]);

                // Enrich queue stats with worker process info
                const queues = await Promise.all(
                    queueStats.map(async (queue) => {
                        const workerNames = QUEUE_WORKER_MAP[queue.name];
                        let workerRunning = false;
                        let workerPid: number | undefined;
                        let workerName: string | undefined;

                        if (workerNames) {
                            const { running, pid, matchedName } = await checkWorkerProcess(workerNames);
                            workerRunning = running;
                            workerPid = pid;
                            workerName = matchedName || workerNames[0]; // Use matched name or first as fallback
                        }

                        return {
                            ...queue,
                            workerRunning,
                            workerPid,
                            workerName,
                        };
                    })
                );

                // Check standalone workers (non-queue-based)
                const standaloneWorkers = await Promise.all(
                    STANDALONE_WORKERS.map(async (worker) => {
                        const { running, pid, matchedName } = await checkWorkerProcess(worker.names);
                        return {
                            name: matchedName || worker.names[0], // Use matched name or first as fallback
                            running,
                            pid,
                            description: worker.description,
                        };
                    })
                );

                // System is healthy if any queue has consumers OR any worker process is running
                const healthy = queues.some(q => q.active || q.workerRunning) || standaloneWorkers.some(w => w.running);

                yield {
                    workerStatusUpdates: {
                        timestamp: new Date().toISOString(),
                        queues,
                        standaloneWorkers,
                        healthy,
                        databaseSizeMB,
                        redis: redisMetrics,
                    },
                };

                // Wait 5 seconds before next update
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        },
    },
};
