import { exec } from 'child_process';
import { promisify } from 'util';
import { Resolvers } from '../generated-types';
import { getAllQueueStats } from '../services/rabbitmq';

const execAsync = promisify(exec);

/**
 * All workers to monitor - checks both RabbitMQ consumer count and actual process status
 */
const MONITORED_WORKERS = [
    // ESI Info Workers
    { name: 'worker:info:alliances', queueName: 'esi_alliance_info_queue', description: 'ESI alliance info enrichment' },
    { name: 'worker:info:characters', queueName: 'esi_character_info_queue', description: 'ESI character info enrichment' },
    { name: 'worker:info:corporations', queueName: 'esi_corporation_info_queue', description: 'ESI corporation info enrichment' },
    { name: 'worker:info:types', queueName: 'esi_type_info_queue', description: 'ESI type info enrichment' },

    // ESI Bulk Workers
    { name: 'worker:alliances', queueName: 'esi_all_alliances_queue', description: 'ESI bulk alliance sync' },
    { name: 'worker:corporations', queueName: 'esi_all_corporations_queue', description: 'ESI bulk corporation sync' },
    { name: 'worker:alliance-corporations', queueName: 'esi_alliance_corporations_queue', description: 'ESI alliance corporation sync' },

    // zKillboard Workers
    { name: 'worker:zkillboard', queueName: 'zkillboard_character_queue', description: 'zKillboard character killmail sync' },
    { name: 'worker:redisq-stream', queueName: 'redisq_stream_queue', description: 'Real-time killmail stream from zKillboard RedisQ' },
];

/**
 * Check if a worker process is running by searching for the worker name in ps output
 */
async function checkWorkerProcess(workerName: string): Promise<{ running: boolean; pid?: number }> {
    try {
        // Search for the worker name in yarn/node processes
        const { stdout } = await execAsync(`ps aux | grep "${workerName}" | grep -v grep`);
        if (stdout.trim()) {
            // Extract PID (second column in ps aux output)
            const lines = stdout.trim().split('\n');
            // Get first matching process (usually the node process, not yarn wrapper)
            const match = lines[0].split(/\s+/);
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

            // Create a map of queue stats for quick lookup
            const queueStatsMap = new Map(
                queues.map(q => [q.name, q])
            );

            // Check each monitored worker's process status and combine with queue stats
            const standaloneWorkers = await Promise.all(
                MONITORED_WORKERS.map(async (worker) => {
                    const { running, pid } = await checkWorkerProcess(worker.name);
                    const queueStats = queueStatsMap.get(worker.queueName);

                    // Worker is considered active if EITHER:
                    // 1. Process is running (ps aux shows it)
                    // 2. RabbitMQ reports consumers (consumerCount > 0)
                    const isActive = running || (queueStats?.consumerCount ?? 0) > 0;

                    return {
                        name: worker.name,
                        running: isActive,
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

                    // Create a map of queue stats for quick lookup
                    const queueStatsMap = new Map(
                        queues.map(q => [q.name, q])
                    );

                    // Check each monitored worker's process status and combine with queue stats
                    const standaloneWorkers = await Promise.all(
                        MONITORED_WORKERS.map(async (worker) => {
                            const { running, pid } = await checkWorkerProcess(worker.name);
                            const queueStats = queueStatsMap.get(worker.queueName);

                            // Worker is considered active if EITHER:
                            // 1. Process is running (ps aux shows it)
                            // 2. RabbitMQ reports consumers (consumerCount > 0)
                            const isActive = running || (queueStats?.consumerCount ?? 0) > 0;

                            return {
                                name: worker.name,
                                running: isActive,
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
