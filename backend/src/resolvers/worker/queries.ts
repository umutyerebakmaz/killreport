import { QueryResolvers } from '@generated-types';
import { getAllQueueStats } from '@services/rabbitmq';
import { checkWorkerProcess, QUEUE_WORKER_MAP, STANDALONE_WORKERS } from './helpers';

/**
 * Worker Query Resolvers
 * Provides real-time monitoring of background workers and queues
 */
export const workerQueries: QueryResolvers = {
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
};
