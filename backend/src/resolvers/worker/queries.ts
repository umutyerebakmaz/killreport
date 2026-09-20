import { QueryResolvers, QueueHealth } from '@generated-types';
import prisma from '@services/prisma';
import { getAllQueueStats } from '@services/rabbitmq';
import {
  queueHealth,
  type QueueHealth as ServiceQueueHealth,
} from '@services/queue-health';
import { CacheManager } from '@utils/cache-manager';
import { QUEUE_WORKER_MAP, STANDALONE_WORKERS } from './helpers';

/**
 * The service speaks a string-literal union and the schema speaks a string
 * enum; TypeScript's string enums are nominal. An exhaustive Record converts
 * without a cast — add a state to the service and this stops compiling.
 */
const QUEUE_HEALTH: Record<ServiceQueueHealth, QueueHealth> = {
  OK: QueueHealth.Ok,
  STALLED: QueueHealth.Stalled,
};

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
 * Worker Query Resolvers
 * Provides real-time monitoring of background workers and queues
 */
export const workerQueries: QueryResolvers = {
  workerStatus: async () => {
    const [queueStats, databaseSizeMB, redisMetrics] = await Promise.all([
      getAllQueueStats(),
      getDatabaseSizeMB(),
      CacheManager.getRedisMetrics(),
    ]);

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
        health: QUEUE_HEALTH[queueHealth(queue)],
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
    const healthy =
      queues.some((q) => q.active || q.workerRunning) ||
      standaloneWorkers.some((w) => w.running);

    return {
      timestamp: new Date().toISOString(),
      queues,
      standaloneWorkers,
      healthy,
      databaseSizeMB,
      redis: redisMetrics,
    };
  },
};
