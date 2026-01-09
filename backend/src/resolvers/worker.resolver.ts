import { Resolvers } from '@generated-types';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getAllQueueStats } from '../services/rabbitmq';

const execAsync = promisify(exec);

/**
 * Queue-to-worker mapping for process detection
 * Maps RabbitMQ queue names to their worker process names
 * Supports both yarn script names and PM2 app names
 */
const QUEUE_WORKER_MAP: Record<string, string[]> = {
    'esi_alliance_info_queue': ['worker:info:alliances', 'worker-alliances'],
    'esi_character_info_queue': ['worker:info:characters', 'worker-characters'],
    'esi_corporation_info_queue': ['worker:info:corporations', 'worker-corporations'],
    'esi_type_info_queue': ['worker:info:types', 'worker-types'],
    'esi_category_info_queue': ['worker:info:categories', 'worker-categories'],
    'esi_item_group_info_queue': ['worker:info:item-groups', 'worker-item-groups'],
    'esi_alliance_corporations_queue': ['worker:alliance-corporations', 'worker-alliance-corporations'],
    'esi_regions_queue': ['worker:regions', 'worker-regions'],
    'esi_constellations_queue': ['worker:constellations', 'worker-constellations'],
    'esi_solar_systems_queue': ['worker:solar-systems', 'worker-solar-systems'],

    'zkillboard_character_queue': ['worker:zkillboard', 'worker-zkillboard'],
};

/**
 * Standalone workers that don't use RabbitMQ queues
 * These run independently and are monitored via process checks only
 * Supports both yarn script names and PM2 app names
 */
const STANDALONE_WORKERS: Array<{ names: string[]; description: string }> = [
    { names: ['worker:redisq', 'worker-redisq', 'killreport-redisq'], description: 'Real-time killmail stream from zKillboard RedisQ' },
];

/**
 * Check if a worker process is running by searching for multiple possible process names
 * Supports both direct yarn execution and PM2-managed processes
 */
async function checkWorkerProcess(workerNames: string[]): Promise<{ running: boolean; pid?: number; matchedName?: string }> {
    // Try each possible worker name
    for (const workerName of workerNames) {
        try {
            // Search for the worker name in yarn/node processes
            // Exclude grep itself and yarn wrappers, focus on actual node processes
            const { stdout } = await execAsync(`ps aux | grep "${workerName}" | grep -v grep | grep -v "yarn-4"`);
            if (stdout.trim()) {
                // Extract PID (second column in ps aux output)
                const lines = stdout.trim().split('\n');
                // Find the actual node process (not yarn wrapper)
                const nodeLine = lines.find(line => line.includes('/node ') || line.includes('/usr/bin/node')) || lines[0];
                const match = nodeLine.split(/\s+/);
                const pid = match[1] ? parseInt(match[1], 10) : undefined;
                return { running: true, pid, matchedName: workerName };
            }
        } catch (error) {
            // grep returns non-zero if no match found, continue to next name
        }
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
                        },
                    };

                    // Wait 5 seconds before next update
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            },
        },
    },
};
