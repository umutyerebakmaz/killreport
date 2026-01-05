import { exec } from 'child_process';
import { promisify } from 'util';
import { Resolvers } from '../generated-types';
import { getAllQueueStats } from '../services/rabbitmq';

const execAsync = promisify(exec);

/**
 * Queue-to-worker mapping for process detection
 * Maps RabbitMQ queue names to their worker process names
 */
const QUEUE_WORKER_MAP: Record<string, string> = {
    'esi_alliance_info_queue': 'worker:info:alliances',
    'esi_character_info_queue': 'worker:info:characters',
    'esi_corporation_info_queue': 'worker:info:corporations',
    'esi_type_info_queue': 'worker:info:types',
    'esi_category_info_queue': 'worker:info:categories',
    'esi_item_group_info_queue': 'worker:info:item-groups',
    'esi_all_alliances_queue': 'worker:alliances',
    'esi_all_corporations_queue': 'worker:corporations',
    'esi_alliance_corporations_queue': 'worker:alliance-corporations',
    'esi_regions_queue': 'worker:regions',
    'esi_constellations_queue': 'worker:constellations',
    'esi_systems_queue': 'worker:systems',
    'zkillboard_character_queue': 'worker:zkillboard',
};

/**
 * Standalone workers that don't use RabbitMQ queues
 * These run independently and are monitored via process checks only
 */
const STANDALONE_WORKERS = [
    { name: 'worker:redisq-stream', description: 'Real-time killmail stream from zKillboard RedisQ' },
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
            const queueStats = await getAllQueueStats();

            // Enrich queue stats with worker process info
            const queues = await Promise.all(
                queueStats.map(async (queue) => {
                    const workerName = QUEUE_WORKER_MAP[queue.name];
                    let workerRunning = false;
                    let workerPid: number | undefined;

                    if (workerName) {
                        const { running, pid } = await checkWorkerProcess(workerName);
                        workerRunning = running;
                        workerPid = pid;
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
                    const { running, pid } = await checkWorkerProcess(worker.name);
                    return {
                        name: worker.name,
                        running,
                        pid,
                        description: worker.description,
                    };
                })
            );

            // System is healthy if any queue has consumers OR any worker process is running
            const healthy = queues.some(q => q.active || q.workerRunning) || standaloneWorkers.some(w => w.running);

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
                    const queueStats = await getAllQueueStats();

                    // Enrich queue stats with worker process info
                    const queues = await Promise.all(
                        queueStats.map(async (queue) => {
                            const workerName = QUEUE_WORKER_MAP[queue.name];
                            let workerRunning = false;
                            let workerPid: number | undefined;

                            if (workerName) {
                                const { running, pid } = await checkWorkerProcess(workerName);
                                workerRunning = running;
                                workerPid = pid;
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
                            const { running, pid } = await checkWorkerProcess(worker.name);
                            return {
                                name: worker.name,
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
                        },
                    };

                    // Wait 5 seconds before next update
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            },
        },
    },
};
