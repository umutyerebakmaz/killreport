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
 */

/**
 * Refresh the materialized view now
 */
export async function refreshMaterializedView(): Promise<void> {
    const startTime = Date.now();

    try {
        logger.info('🔄 Starting materialized view refresh...');

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
 */
export async function refreshDailyPilotKillsMv(): Promise<void> {
    const startTime = Date.now();
    try {
        logger.info('🔄 Refreshing daily_pilot_kills_mv...');
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
 * Refreshes every 5 minutes
 */
export function scheduleMaterializedViewRefresh(): NodeJS.Timeout {
    const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

    logger.info('📅 Scheduling materialized view refresh every 5 minutes');

    // Run initial check after 30 seconds (give server time to start)
    setTimeout(async () => {
        try {
            const stats = await getViewStats();
            logger.info('📊 Materialized view stats:', stats);

            if (await needsRefresh()) {
                await refreshMaterializedView();
            }

            await refreshDailyPilotKillsMv();
        } catch (error) {
            logger.error('❌ Error in initial materialized view refresh:', error);
        }
    }, 30000);

    // Schedule periodic refresh
    const intervalId = setInterval(async () => {
        try {
            if (await needsRefresh()) {
                await refreshMaterializedView();
            } else {
                logger.info('✨ Materialized view is up to date, skipping refresh');
            }

            // daily_pilot_kills_mv: always refresh — cheap incremental computation
            await refreshDailyPilotKillsMv();
        } catch (error) {
            logger.error('❌ Error in scheduled materialized view refresh:', error);
        }
    }, REFRESH_INTERVAL);

    logger.info('✅ Materialized view refresh scheduler started');

    return intervalId;
}
