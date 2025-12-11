import { exec } from 'child_process';
import { promisify } from 'util';
import { Resolvers } from '../generated-types';
import { getAllQueueStats } from '../services/rabbitmq';

const execAsync = promisify(exec);

/**
 * Standalone workers that don't use RabbitMQ
 */
const STANDALONE_WORKERS = [
    {
        name: 'redisq_stream',
        processName: 'worker-redisq-stream',
        description: 'Real-time killmail stream from zKillboard RedisQ',
    },
];

/**
 * Check if a standalone worker process is running
 */
async function checkStandaloneWorker(processName: string): Promise<{ running: boolean; pid?: number }> {
    try {
        const { stdout } = await execAsync(`ps aux | grep "${processName}" | grep -v grep`);
        if (stdout.trim()) {
            // Extract PID (second column)
            const match = stdout.trim().split(/\s+/);
            const pid = match[1] ? parseInt(match[1], 10) : undefined;
            return { running: true, pid };
        }
    } catch (error) {
        // grep returns non-zero if no match found
    }
    return { running: false };
}

/**
 * Worker Status Resolver
 * Provides real-time monitoring of background workers and queues
 */
export const workerResolvers: Resolvers = {
    Query: {
        workerStatus: async () => {
            const queues = await getAllQueueStats();

            // Check standalone workers
            const standaloneWorkers = await Promise.all(
                STANDALONE_WORKERS.map(async (worker) => {
                    const { running, pid } = await checkStandaloneWorker(worker.processName);
                    return {
                        name: worker.name,
                        running,
                        pid,
                        description: worker.description,
                    };
                })
            );

            // Consider system healthy if at least one worker is active
            const healthy = queues.some(q => q.active) || standaloneWorkers.some(w => w.running);

            return {
                timestamp: new Date().toISOString(),
                queues,
                standaloneWorkers,
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

                    // Check standalone workers
                    const standaloneWorkers = await Promise.all(
                        STANDALONE_WORKERS.map(async (worker) => {
                            const { running, pid } = await checkStandaloneWorker(worker.processName);
                            return {
                                name: worker.name,
                                running,
                                pid,
                                description: worker.description,
                            };
                        })
                    );

                    const healthy = queues.some(q => q.active) || standaloneWorkers.some(w => w.running);

                    yield {
                        workerStatusUpdates: {
                            timestamp: new Date().toISOString(),
                            queues,
                            standaloneWorkers,
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
