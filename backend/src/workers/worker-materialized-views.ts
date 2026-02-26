/**
 * Materialized View Refresh Worker
 *
 * Periodically refreshes materialized views for high-performance queries.
 * Runs independently from the API server for better isolation and stability.
 *
 * ⚡ NEW: Real-time incremental updates
 * - Daily tables (pilot/corp/alliance kills) are now updated in REAL-TIME
 *   as killmails are saved (see daily-aggregates-realtime.ts)
 * - This worker now serves as a FALLBACK/CONSISTENCY CHECK
 * - Runs every 5 minutes to catch any missed updates
 * - Full refresh still happens once per day at 3 AM UTC
 *
 * Features:
 * - Staggered refresh to reduce CPU spikes (10-20s delays)
 * - Character view throttling (10 min intervals)
 * - Intelligent refresh (only when new data exists)
 * - Memory optimization (128MB maintenance_work_mem)
 * - Cleanup on shutdown
 *
 * Usage:
 *   yarn worker:materialized-views
 *
 * PM2:
 *   pm2 start "yarn worker:materialized-views" --name "mv-refresh-worker"
 */

import logger from '@services/logger';
import {
  incrementalRefreshDailyAllianceKills,
  incrementalRefreshDailyCorporationKills,
  incrementalRefreshDailyPilotKills,
  incrementalRefreshKillmailFilters
} from '@services/materialized-view-incremental';
import prismaWorker from '@services/prisma-worker';

// Track active timeouts for cleanup
const activeTimeouts: NodeJS.Timeout[] = [];
let mainIntervalId: NodeJS.Timeout | null = null;
let isShuttingDown = false;

/**
 * Generic refresh function factory (for full refresh of character views)
 */
function createRefreshFunction(viewName: string, memoryMB: number) {
  return async function (): Promise<void> {
    if (isShuttingDown) {
      logger.info('⚠️ Shutdown in progress, skipping refresh');
      return;
    }

    const startTime = Date.now();

    try {
      logger.info(`🔄 Refreshing ${viewName}...`);

      await prismaWorker.$executeRawUnsafe(`SET LOCAL maintenance_work_mem = '${memoryMB}MB'`);
      await prismaWorker.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`);

      const duration = Date.now() - startTime;
      logger.info(`✅ ${viewName} refreshed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Error refreshing ${viewName} after ${duration}ms:`, error);
      throw error;
    }
  };
}

// Create refresh functions for character views (still use full refresh, cheaper views)
const refreshCharacterTopAllianceTargetsMv = createRefreshFunction('character_top_alliance_targets_mv', 128);
const refreshCharacterTopCorporationTargetsMv = createRefreshFunction('character_top_corporation_targets_mv', 128);

// Track last refresh times for character views
let lastCharacterViewRefresh = 0;
const CHARACTER_VIEW_REFRESH_THROTTLE = 10 * 60 * 1000; // 10 minutes

/**
 * Check if character views need refresh
 */
function needsCharacterViewRefresh(): boolean {
  const now = Date.now();
  const timeSinceLastRefresh = now - lastCharacterViewRefresh;

  if (timeSinceLastRefresh < CHARACTER_VIEW_REFRESH_THROTTLE) {
    logger.debug(`⏭️  Skipping character view refresh (last refreshed ${Math.round(timeSinceLastRefresh / 1000)}s ago)`);
    return false;
  }

  return true;
}

/**
 * Mark character views as refreshed
 */
function markCharacterViewRefreshed(): void {
  lastCharacterViewRefresh = Date.now();
}

/**
 * Perform refresh cycle with staggered execution to prevent CPU spikes
 *
 * OPTIMIZATION: Uses incremental refresh for main views
 * - killmail_filters: Incremental (only new records)
 * - daily_pilot_kills: Incremental (only last 6 hours)
 * - daily_corporation_kills: Incremental (only last 6 hours)
 * - daily_alliance_kills: Incremental (only last 6 hours)
 * - Character views: Full refresh but staggered by 30-60s
 */
async function performRefreshCycle() {
  if (isShuttingDown) return;

  const STAGGER_DELAY = 30 * 1000; // 30 seconds

  try {
    // 1. Killmail filters - INCREMENTAL refresh (only new records)
    logger.info('🔄 Starting killmail_filters incremental refresh...');
    await incrementalRefreshKillmailFilters();

    // 2. Daily pilot kills - INCREMENTAL refresh (only last 2 days)
    // Stagger by 10 seconds to avoid concurrent CPU usage
    const timeout0 = setTimeout(async () => {
      try {
        logger.info('🔄 Starting daily_pilot_kills incremental refresh...');
        await incrementalRefreshDailyPilotKills();
      } catch (error) {
        logger.error('❌ Error refreshing daily pilot kills:', error);
      }
    }, 10000); // 10 second stagger
    activeTimeouts.push(timeout0);

    // 2b. Daily corporation kills - INCREMENTAL refresh
    const timeout0b = setTimeout(async () => {
      try {
        logger.info('🔄 Starting daily_corporation_kills incremental refresh...');
        await incrementalRefreshDailyCorporationKills();
      } catch (error) {
        logger.error('❌ Error refreshing daily corporation kills:', error);
      }
    }, 15000); // 15 second stagger
    activeTimeouts.push(timeout0b);

    // 2c. Daily alliance kills - INCREMENTAL refresh
    const timeout0c = setTimeout(async () => {
      try {
        logger.info('🔄 Starting daily_alliance_kills incremental refresh...');
        await incrementalRefreshDailyAllianceKills();
      } catch (error) {
        logger.error('❌ Error refreshing daily alliance kills:', error);
      }
    }, 20000); // 20 second stagger
    activeTimeouts.push(timeout0c);

    // 3. Character target views - only refresh if throttle period has passed
    if (needsCharacterViewRefresh()) {
      markCharacterViewRefreshed();

      // 3a. Character alliance targets - stagger by 30 seconds
      const timeout1 = setTimeout(async () => {
        try {
          await refreshCharacterTopAllianceTargetsMv();
        } catch (error) {
          logger.error('❌ Error refreshing character alliance targets:', error);
        }
      }, STAGGER_DELAY);
      activeTimeouts.push(timeout1);

      // 3b. Character corporation targets - stagger by 60 seconds
      const timeout2 = setTimeout(async () => {
        try {
          await refreshCharacterTopCorporationTargetsMv();
        } catch (error) {
          logger.error('❌ Error refreshing character corporation targets:', error);
        }
      }, STAGGER_DELAY * 2);
      activeTimeouts.push(timeout2);
    } else {
      logger.info('⏭️  Skipping character view refresh (throttled)');
    }
  } catch (error) {
    logger.error('❌ Error in materialized view refresh cycle:', error);
  }
}

/**
 * Cleanup function
 */
async function cleanup() {
  isShuttingDown = true;
  logger.info('🛑 Shutting down materialized view refresh worker...');

  // Clear interval
  if (mainIntervalId) {
    clearInterval(mainIntervalId);
  }

  // Clear all timeouts
  activeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
  activeTimeouts.length = 0;

  // Disconnect Prisma
  await prismaWorker.$disconnect();

  logger.info('✅ Materialized view refresh worker stopped gracefully');
  process.exit(0);
}

/**
 * Main worker function
 */
async function startMaterializedViewRefreshWorker() {
  logger.info('🚀 Materialized View Refresh Worker Starting (Incremental Mode)...');

  const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

  try {
    // Perform initial refresh after 30 seconds (give worker time to start)
    setTimeout(async () => {
      logger.info('🔄 Starting initial refresh cycle...');
      await performRefreshCycle();
    }, 30000);

    // Schedule periodic refresh every 5 minutes
    mainIntervalId = setInterval(async () => {
      logger.info('🔄 Starting scheduled refresh cycle...');
      await performRefreshCycle();
    }, REFRESH_INTERVAL);

    logger.info('✅ Materialized view refresh worker started successfully');
    logger.info('📅 Refresh interval: 5 minutes (incremental updates)');
    logger.info('🎯 Character views: Every 10 minutes (throttled)');
    logger.info('⚡ Full refresh: Once per day at 3 AM UTC');

    // Graceful shutdown handlers
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

  } catch (error) {
    logger.error('❌ Worker failed to start:', error);
    await prismaWorker.$disconnect();
    process.exit(1);
  }
}

// Start the worker
startMaterializedViewRefreshWorker();
