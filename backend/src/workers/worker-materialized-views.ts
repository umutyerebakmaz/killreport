/**
 * Materialized View Refresh Worker
 *
 * Periodically refreshes materialized views for high-performance queries.
 * Runs independently from the API server for better isolation and stability.
 *
 * Features:
 * - Staggered refresh to reduce CPU spikes (30s delays)
 * - Character view throttling (10 min intervals)
 * - Intelligent refresh (only when new data exists)
 * - Memory optimization (128-256MB maintenance_work_mem)
 * - Cleanup on shutdown
 *
 * Usage:
 *   yarn worker:materialized-views
 *
 * PM2:
 *   pm2 start "yarn worker:materialized-views" --name "mv-refresh-worker"
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';

// Track active timeouts for cleanup
const activeTimeouts: NodeJS.Timeout[] = [];
let mainIntervalId: NodeJS.Timeout | null = null;
let isShuttingDown = false;

/**
 * Generic refresh function factory
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

// Create refresh functions
const refreshMaterializedView = createRefreshFunction('killmail_filters_mv', 256);
const refreshDailyPilotKillsMv = createRefreshFunction('daily_pilot_kills_mv', 128);
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
 * Check if killmail_filters_mv needs refresh
 */
async function needsRefresh(): Promise<boolean> {
    try {
        // Use pg_stat_user_tables for fast approximate counts
        const result = await prismaWorker.$queryRaw<Array<{ mv_count: bigint | null; table_count: bigint | null }>>`
            SELECT
                (SELECT n_live_tup FROM pg_stat_user_tables WHERE schemaname = 'public' AND relname = 'killmail_filters_mv') as mv_count,
                (SELECT n_live_tup FROM pg_stat_user_tables WHERE schemaname = 'public' AND relname = 'killmails') as table_count
        `;

        // Fallback to COUNT if stats not available
        if (!result[0].mv_count || !result[0].table_count) {
            logger.debug('📊 Stats not available, using COUNT fallback');
            const [mvCount, tableCount] = await Promise.all([
                prismaWorker.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM killmail_filters_mv`,
                prismaWorker.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM killmails`
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
        return false;
    }
}

/**
 * Get materialized view statistics
 */
async function getViewStats(): Promise<{
    totalRecords: number;
    lastRefreshCheck: Date;
    estimatedSize: string;
}> {
    try {
        const [countResult, sizeResult] = await Promise.all([
            prismaWorker.$queryRaw<Array<{ count: bigint }>>`
                SELECT COUNT(*) as count FROM killmail_filters_mv
            `,
            prismaWorker.$queryRaw<Array<{ size: string }>>`
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
 * Perform refresh cycle
 */
async function performRefreshCycle() {
    if (isShuttingDown) return;

    const STAGGER_DELAY = 30 * 1000; // 30 seconds

    try {
        // 1. Main killmail filters view - only if needed
        if (await needsRefresh()) {
            await refreshMaterializedView();
        } else {
            logger.info('✨ Killmail filters view is up to date, skipping refresh');
        }

        // 2. Daily pilot kills - always refresh (cheap, incremental)
        await refreshDailyPilotKillsMv();

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
    logger.info('🚀 Materialized View Refresh Worker Starting...');

    const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

    try {
        // Initial stats
        const stats = await getViewStats();
        logger.info('📊 Materialized view stats:', stats);

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
        logger.info('📅 Refresh interval: 5 minutes (staggered execution)');
        logger.info('🎯 Character views: Every 10 minutes (throttled)');

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
