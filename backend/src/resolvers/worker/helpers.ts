import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Queue-to-worker mapping for process detection
 * Maps RabbitMQ queue names to their worker process names
 * Supports both yarn script names and PM2 app names
 */
export const QUEUE_WORKER_MAP: Record<string, string[]> = {
  esi_alliance_info_queue: ['worker:info:alliances', 'worker-alliances'],
  esi_character_info_queue: ['worker:info:characters', 'worker-characters'],
  esi_corporation_info_queue: [
    'worker:info:corporations',
    'worker-corporations',
  ],
  esi_type_info_queue: ['worker:info:types', 'worker-types'],
  esi_category_info_queue: ['worker:info:categories', 'worker-categories'],
  esi_item_group_info_queue: ['worker:info:item-groups', 'worker-item-groups'],
  esi_dogma_attribute_info_queue: [
    'worker:info:dogma-attributes',
    'worker-dogma-attributes',
  ],
  esi_dogma_effect_info_queue: [
    'worker:info:dogma-effects',
    'worker-dogma-effects',
  ],
  esi_type_dogma_queue: ['worker:type-dogma', 'worker-type-dogma'],
  esi_alliance_corporations_queue: [
    'worker:alliance-corporations',
    'worker-alliance-corporations',
  ],
  esi_regions_queue: ['worker:regions', 'worker-regions'],
  esi_constellations_queue: ['worker:constellations', 'worker-constellations'],
  esi_solar_systems_queue: ['worker:solar-systems', 'worker-solar-systems'],
  esi_stars_queue: ['worker:stars', 'worker-stars'],
  esi_planets_queue: ['worker:planets', 'worker-planets'],
  esi_moons_queue: ['worker:moons', 'worker-moons'],
  esi_asteroid_belts_queue: ['worker:asteroid-belts', 'worker-asteroid-belts'],
  esi_stargates_queue: ['worker:stargates', 'worker-stargates'],
  esi_stations_queue: ['worker:stations', 'worker-stations'],
  esi_type_price_queue: ['worker:prices', 'worker-prices'],

  // The script names drop the `esi-` their files carry, so the second name is
  // the file's, which is what checkWorkerProcess can find in `ps`.
  esi_user_killmails_queue: [
    'worker:user-killmails',
    'worker-esi-user-killmails',
  ],
  esi_corporation_killmails_queue: [
    'worker:corporation-killmails',
    'worker-esi-corporation-killmails',
  ],
  esi_killmail_detail_queue: [
    'worker:killmail-detail',
    'worker-killmail-detail',
  ],

  zkillboard_character_queue: ['worker:zkillboard', 'worker-zkillboard'],

  backfill_killmail_values_queue: [
    'worker:backfill-values',
    'worker-backfill-values',
  ],
};

/**
 * Standalone workers that don't use RabbitMQ queues
 * These run independently and are monitored via process checks only
 * Supports both yarn script names and PM2 app names
 */
export const STANDALONE_WORKERS: Array<{
  names: string[];
  description: string;
}> = [
  {
    names: ['worker:redisq', 'worker-redisq', 'killreport-redisq'],
    description: 'Real-time killmail stream from zKillboard RedisQ',
  },
];

/**
 * Check if a worker process is running by searching for multiple possible process names
 * Supports both direct yarn execution and PM2-managed processes
 */
export async function checkWorkerProcess(
  workerNames: string[],
): Promise<{ running: boolean; pid?: number; matchedName?: string }> {
  // Try each possible worker name
  for (const workerName of workerNames) {
    try {
      // Extract the worker file name for yarn processes (e.g., worker-prices)
      const workerFileName = workerName
        .replace('worker:', 'worker-')
        .replace(/:/g, '-');

      // Search in process list for:
      // 1. PM2: app name matches (worker-prices)
      // 2. Yarn/Node: file path contains workers/worker-prices
      const { stdout } = await execAsync(
        `ps aux | grep node | grep -E "(workers/${workerFileName}|${workerFileName}\\.ts)" | grep -v grep`,
      );

      if (stdout.trim()) {
        // Extract PID (second column in ps aux output)
        const lines = stdout.trim().split('\n');
        // Get the first actual node process
        const nodeLine = lines[0];
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
