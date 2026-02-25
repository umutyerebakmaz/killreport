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

/**
 * Refresh the materialized view now
 * Optimized with increased maintenance_work_mem for better performance
 */
export async function refreshMaterializedView(): Promise<void> {
    const startTime = Date.now();

    try {
        logger.info('🔄 Starting materialized view refresh...');

        // Set maintenance_work_mem to 256MB for this session to speed up index rebuild
        // This reduces CPU spikes by allowing PostgreSQL to use more RAM for sorting
        await prisma.$executeRawUnsafe('SET LOCAL maintenance_work_mem = \'256MB\'');

        // CONCURRENTLY allows queries to continue during refresh
        // Requires unique index on killmail_id (created in migration)
        await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY killmail_filters_mv');

        const duration = Date.now() - startTime;
        logger.info(`✅ Materialized view refreshed successfully in ${duration}ms`);
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`❌ Error refreshing materialized view after ${duration}ms:`, error);
        throw error;
    }
}

/**
 * Refresh the daily_pilot_kills_mv materialized view
 * Pre-aggregated kill counts per pilot per UTC day — used by the leaderboard.
 * Refresh is cheap (only touches today's rows need recomputing).
 *
 * OPTIMIZATION: Uses increased work_mem for faster aggregation
 */
export async function refreshDailyPilotKillsMv(): Promise<void> {
    const startTime = Date.now();
    try {
        logger.info('🔄 Refreshing daily_pilot_kills_mv...');

        // Set maintenance_work_mem for this session
        await prisma.$executeRawUnsafe('SET LOCAL maintenance_work_mem = \'128MB\'');

        await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY daily_pilot_kills_mv');
        const duration = Date.now() - startTime;
        logger.info(`✅ daily_pilot_kills_mv refreshed in ${duration}ms`);
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`❌ Error refreshing daily_pilot_kills_mv after ${duration}ms:`, error);
        throw error;
    }
}

/**
 * Refresh character top alliance targets materialized view
 * Pre-aggregated top 10 alliance targets per character — used by character detail page.
 *
 * OPTIMIZATION: Uses increased work_mem for faster window function operations
 */
export async function refreshCharacterTopAllianceTargetsMv(): Promise<void> {
    const startTime = Date.now();
    try {
        logger.info('🔄 Refreshing character_top_alliance_targets_mv...');

        // Set maintenance_work_mem for this session
        await prisma.$executeRawUnsafe('SET LOCAL maintenance_work_mem = \'128MB\'');

        await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY character_top_alliance_targets_mv');
        const duration = Date.now() - startTime;
        logger.info(`✅ character_top_alliance_targets_mv refreshed in ${duration}ms`);
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`❌ Error refreshing character_top_alliance_targets_mv after ${duration}ms:`, error);
        throw error;
    }
}

/**
 * Refresh character top corporation targets materialized view
 * Pre-aggregated top 10 corporation targets per character — used by character detail page.
 *
 * OPTIMIZATION: Uses increased work_mem for faster window function operations
 */
export async function refreshCharacterTopCorporationTargetsMv(): Promise<void> {
    const startTime = Date.now();
    try {
        logger.info('🔄 Refreshing character_top_corporation_targets_mv...');

        // Set maintenance_work_mem for this session
        await prisma.$executeRawUnsafe('SET LOCAL maintenance_work_mem = \'128MB\'');

        await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY character_top_corporation_targets_mv');
        const duration = Date.now() - startTime;
        logger.info(`✅ character_top_corporation_targets_mv refreshed in ${duration}ms`);
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`❌ Error refreshing character_top_corporation_targets_mv after ${duration}ms:`, error);
        throw error;
    }
}

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
 */
export async function needsRefresh(): Promise<boolean> {
    try {
        // Check when materialized view was last refreshed
        // PostgreSQL doesn't track this automatically, so we compare record counts

        const [mvCount, tableCount] = await Promise.all([
            prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM killmail_filters_mv
      `,
            prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM killmails
      `
        ]);

        const mvRecords = Number(mvCount[0].count);
        const tableRecords = Number(tableCount[0].count);

        // If difference is more than 100 records, refresh needed
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
 * Schedule automatic refresh (called from server.ts)
 * Refreshes every 5 minutes with STAGGERED timing to reduce CPU spikes
 *
 * OPTIMIZATION STRATEGY:
 * - Main view (killmail_filters_mv): Only refresh when new data exists (needsRefresh check)
 * - Daily pilots view: Always refresh (cheap, incremental)
 * - Character views: Staggered by 30 seconds to avoid concurrent CPU usage
 * - Parallel execution replaced with sequential for character views
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
            setTimeout(async () => {
                try {
                    await refreshCharacterTopAllianceTargetsMv();
                } catch (error) {
                    logger.error('❌ Error refreshing character alliance targets:', error);
                }
            }, STAGGER_DELAY);

            // 4. Character corporation targets - stagger by 60 seconds
            setTimeout(async () => {
                try {
                    await refreshCharacterTopCorporationTargetsMv();
                } catch (error) {
                    logger.error('❌ Error refreshing character corporation targets:', error);
                }
            }, STAGGER_DELAY * 2);

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
                // 3a. Character alliance targets - stagger by 30 seconds to reduce CPU spikes
                setTimeout(async () => {
                    try {
                        await refreshCharacterTopAllianceTargetsMv();
                    } catch (error) {
                        logger.error('❌ Error refreshing character alliance targets:', error);
                    }
                }, STAGGER_DELAY);

                // 3b. Character corporation targets - stagger by 60 seconds
                setTimeout(async () => {
                    try {
                        await refreshCharacterTopCorporationTargetsMv();
                        // Mark as refreshed after both views complete
                        markCharacterViewRefreshed();
                    } catch (error) {
                        logger.error('❌ Error refreshing character corporation targets:', error);
                    }
                }, STAGGER_DELAY * 2);
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
