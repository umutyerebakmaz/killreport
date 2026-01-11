import { QueryResolvers } from '@generated-types';
import { getAllQueueStats } from '@services/rabbitmq';
import { QUEUE_WORKER_MAP, STANDALONE_WORKERS } from './helpers';

/**
 * Worker Query Resolvers
 * Provides real-time monitoring of background workers and queues
 */
export const workerQueries: QueryResolvers = {
  workerStatus: async () => {
    const queueStats = await getAllQueueStats();

    // Enrich queue stats with worker info from mapping
    const queues = queueStats.map((queue) => {
      const workerNames = QUEUE_WORKER_MAP[queue.name];

      // Simple: if consumers exist, worker is running
      const workerRunning = queue.consumerCount > 0;
      const workerName = workerNames ? workerNames[0] : undefined;

      return {
        ...queue,
        workerRunning,
        workerPid: undefined, // Not tracking PIDs - too complex
        workerName,
      };
    });

    // Check standalone workers (non-queue-based)
    // For now, assume they're not running since we removed ps aux checks
    const standaloneWorkers = STANDALONE_WORKERS.map((worker) => ({
      name: worker.names[0],
      running: false, // Would need proper health check endpoint
      pid: undefined,
      description: worker.description,
    }));

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
