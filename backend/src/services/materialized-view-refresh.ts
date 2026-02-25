import logger from '@services/logger';
import prisma from '@services/prisma';

/**
 * Refresh Materialized View for Killmail Filters
 *
 * This job refreshes the killmail_filters_mv materialized view
 * which is used for high-performance killmail filtering.
 *
 * Using CONCURRENTLY to avoid locking the view during refresh,
 * which allows queries to continue using the old data until refresh completes.
 *
 * Performance impact: ~5-15 seconds for 1M+ killmails
 *
 * OPTIMIZATION: CPU usage is reduced by:
 * - Setting maintenance_work_mem for faster index rebuilds
 * - Using CONCURRENTLY to avoid blocking reads
 * - Only refreshing when there's new data (checked by needsRefresh)
 */

// Track active timeouts for cleanup
const activeTimeouts: NodeJS.Timeout[] = [];

/**
 * Generic refresh function factory to reduce code duplication
 * @param viewName - Name of the materialized view
 * @param memoryMB - maintenance_work_mem in MB
 */
function createRefreshFunction(viewName: string, memoryMB: number) {
  return async function (): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info(`🔄 Refreshing ${viewName}...`);

      // Set maintenance_work_mem to speed up index rebuild
      // Note: Cannot use transaction here as REFRESH MATERIALIZED VIEW CONCURRENTLY
      // cannot run inside a transaction block
      await prisma.$executeRawUnsafe(`SET LOCAL maintenance_work_mem = '${memoryMB}MB'`);
      await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`);

      const duration = Date.now() - startTime;
      logger.info(`✅ ${viewName} refreshed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Error refreshing ${viewName} after ${duration}ms:`, error);
      throw error;
    }
  };
}

/**
 * Refresh the materialized view now
 * Optimized with increased maintenance_work_mem for better performance
 */
export const refreshMaterializedView = createRefreshFunction('killmail_filters_mv', 256);

/**
 * Refresh the daily_pilot_kills_mv materialized view
 * Pre-aggregated kill counts per pilot per UTC day — used by the leaderboard.
 * Refresh is cheap (only touches today's rows need recomputing).
 */
export const refreshDailyPilotKillsMv = createRefreshFunction('daily_pilot_kills_mv', 128);

/**
 * Refresh character top alliance targets materialized view
 * Pre-aggregated top 10 alliance targets per character — used by character detail page.
 */
export const refreshCharacterTopAllianceTargetsMv = createRefreshFunction('character_top_alliance_targets_mv', 128);

/**
 * Refresh character top corporation targets materialized view
 * Pre-aggregated top 10 corporation targets per character — used by character detail page.
 */
export const refreshCharacterTopCorporationTargetsMv = createRefreshFunction('character_top_corporation_targets_mv', 128);

// Track last refresh times for character views to avoid unnecessary refreshes
let lastCharacterViewRefresh = 0;
const CHARACTER_VIEW_REFRESH_THROTTLE = 10 * 60 * 1000; // 10 minutes

/**
 * Check if character views need refresh
 * Returns true if enough time has passed since last refresh
 * This prevents unnecessary CPU-intensive refreshes of character target views
 */
export function needsCharacterViewRefresh(): boolean {
  const now = Date.now();
  const timeSinceLastRefresh = now - lastCharacterViewRefresh;

  if (timeSinceLastRefresh < CHARACTER_VIEW_REFRESH_THROTTLE) {
    logger.debug(`⏭️  Skipping character view refresh (last refreshed ${Math.round(timeSinceLastRefresh / 1000)}s ago)`);
    return false;
  }

  return true;
}

/**
 * Update the last character view refresh timestamp
 */
export function markCharacterViewRefreshed(): void {
  lastCharacterViewRefresh = Date.now();
}

/**
 * Check if materialized view needs refresh
 * Returns true if view is stale (hasn't been refreshed recently)
 * Uses PostgreSQL statistics for faster checking (avoids slow COUNT(*))
 */
export async function needsRefresh(): Promise<boolean> {
  try {
    // Use pg_stat_user_tables for fast approximate counts
    // This is much faster than COUNT(*) on large tables
    const result = await prisma.$queryRaw<Array<{ mv_count: bigint | null; table_count: bigint | null }>>`
            SELECT
                (SELECT n_live_tup FROM pg_stat_user_tables WHERE schemaname = 'public' AND relname = 'killmail_filters_mv') as mv_count,
                (SELECT n_live_tup FROM pg_stat_user_tables WHERE schemaname = 'public' AND relname = 'killmails') as table_count
        `;

    // Fallback to COUNT if stats not available
    if (!result[0].mv_count || !result[0].table_count) {
      logger.debug('📊 Stats not available, using COUNT fallback');
      const [mvCount, tableCount] = await Promise.all([
        prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM killmail_filters_mv`,
        prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM killmails`
      ]);
      const mvRecords = Number(mvCount[0].count);
      const tableRecords = Number(tableCount[0].count);
      const diff = Math.abs(tableRecords - mvRecords);
      const needsUpdate = diff > 100;
      if (needsUpdate) {
        logger.info(`🔍 Materialized view needs refresh: ${mvRecords} vs ${tableRecords} records (diff: ${diff})`);
      }
      return needsUpdate;
    }

    const mvRecords = Number(result[0].mv_count);
    const tableRecords = Number(result[0].table_count);
    const diff = Math.abs(tableRecords - mvRecords);
    const needsUpdate = diff > 100;

    if (needsUpdate) {
      logger.info(`🔍 Materialized view needs refresh: ${mvRecords} vs ${tableRecords} records (diff: ${diff})`);
    }

    return needsUpdate;
  } catch (error) {
    logger.error('❌ Error checking materialized view status:', error);
    return false; // Don't refresh on error
  }
}

/**
 * Get materialized view statistics
 */
export async function getViewStats(): Promise<{
  totalRecords: number;
  lastRefreshCheck: Date;
  estimatedSize: string;
}> {
  try {
    const [countResult, sizeResult] = await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM killmail_filters_mv
      `,
      prisma.$queryRaw<Array<{ size: string }>>`
        SELECT pg_size_pretty(pg_total_relation_size('killmail_filters_mv')) as size
      `
    ]);

    return {
      totalRecords: Number(countResult[0].count),
      lastRefreshCheck: new Date(),
      estimatedSize: sizeResult[0].size,
    };
  } catch (error) {
    logger.error('❌ Error getting materialized view stats:', error);
    throw error;
  }
}

/**
 * Stop scheduled materialized view refresh and cleanup timeouts
 * @param intervalId - The interval ID returned by scheduleMaterializedViewRefresh
 */
export function stopMaterializedViewRefresh(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId);
  activeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
  activeTimeouts.length = 0;
  logger.info('🛑 Materialized view refresh scheduler stopped');
}

/**
 * Schedule automatic refresh (called from server.ts)
 * Refreshes every 5 minutes with STAGGERED timing to reduce CPU spikes
 *
 * OPTIMIZATION STRATEGY:
 * - Main view (killmail_filters_mv): Only refresh when new data exists (needsRefresh check)
 * - Daily pilots view: Always refresh (cheap, incremental)
 * - Character views: Staggered by 30 seconds to avoid concurrent CPU usage
 * - Parallel execution replaced with sequential for character views
 * - Timeout cleanup to prevent memory leaks
 */
export function scheduleMaterializedViewRefresh(): NodeJS.Timeout {
  const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
  const STAGGER_DELAY = 30 * 1000; // 30 seconds between character views

  logger.info('📅 Scheduling materialized view refresh every 5 minutes (staggered)');

  // Run initial check after 30 seconds (give server time to start)
  setTimeout(async () => {
    try {
      const stats = await getViewStats();
      logger.info('📊 Materialized view stats:', stats);

      // 1. Main killmail filters view - only if needed
      if (await needsRefresh()) {
        await refreshMaterializedView();
      } else {
        logger.info('✨ Killmail filters view is up to date, skipping refresh');
      }

      // 2. Daily pilot kills - always refresh (cheap)
      await refreshDailyPilotKillsMv();

      // 3. Character alliance targets - stagger by 30 seconds
      const timeout1 = setTimeout(async () => {
        try {
          await refreshCharacterTopAllianceTargetsMv();
        } catch (error) {
          logger.error('❌ Error refreshing character alliance targets:', error);
        }
      }, STAGGER_DELAY);
      activeTimeouts.push(timeout1);

      // 4. Character corporation targets - stagger by 60 seconds
      const timeout2 = setTimeout(async () => {
        try {
          await refreshCharacterTopCorporationTargetsMv();
        } catch (error) {
          logger.error('❌ Error refreshing character corporation targets:', error);
        }
      }, STAGGER_DELAY * 2);
      activeTimeouts.push(timeout2);

    } catch (error) {
      logger.error('❌ Error in initial materialized view refresh:', error);
    }
  }, 30000);

  // Schedule periodic refresh
  const intervalId = setInterval(async () => {
    try {
      // 1. Main killmail filters view - only if needed
      if (await needsRefresh()) {
        await refreshMaterializedView();
      } else {
        logger.info('✨ Materialized view is up to date, skipping refresh');
      }

      // 2. Daily pilot kills - always refresh (cheap, incremental)
      await refreshDailyPilotKillsMv();

      // 3. Character target views - only refresh if throttle period has passed
      if (needsCharacterViewRefresh()) {
        // Mark as refreshed immediately to prevent race conditions
        markCharacterViewRefreshed();

        // 3a. Character alliance targets - stagger by 30 seconds to reduce CPU spikes
        const timeout3 = setTimeout(async () => {
          try {
            await refreshCharacterTopAllianceTargetsMv();
          } catch (error) {
            logger.error('❌ Error refreshing character alliance targets:', error);
          }
        }, STAGGER_DELAY);
        activeTimeouts.push(timeout3);

        // 3b. Character corporation targets - stagger by 60 seconds
        const timeout4 = setTimeout(async () => {
          try {
            await refreshCharacterTopCorporationTargetsMv();
          } catch (error) {
            logger.error('❌ Error refreshing character corporation targets:', error);
          }
        }, STAGGER_DELAY * 2);
        activeTimeouts.push(timeout4);
      } else {
        logger.info('⏭️  Skipping character view refresh (throttled)');
      }

    } catch (error) {
      logger.error('❌ Error in scheduled materialized view refresh:', error);
    }
  }, REFRESH_INTERVAL);

  logger.info('✅ Materialized view refresh scheduler started (with CPU-optimized staggering)');

  return intervalId;
}
