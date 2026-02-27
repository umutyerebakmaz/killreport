/**
 * Data Retention Cleanup Worker
 *
 * Periodically removes old data from aggregated tables to optimize storage.
 * Runs independently as a scheduled PM2 worker (default: weekly on Sunday 2 AM UTC).
 *
 * Features:
 * - Configurable retention period (via .env RETENTION_DAYS)
 * - Batch deletion to avoid long locks
 * - Detailed logging and statistics
 * - Graceful shutdown handling
 *
 * Cleaned Tables:
 * - daily_pilot_kills (older than retention period)
 * - daily_corporation_kills (older than retention period)
 * - daily_alliance_kills (older than retention period)
 *
 * NOT Cleaned (critical for performance):
 * - killmail_filters (essential cache table, never deleted)
 *
 * Note: Base killmails data is NOT deleted, only daily aggregation tables.
 *
 * Usage:
 *   yarn worker:retention-cleanup
 *
 * PM2 (Weekly Schedule):
 *   pm2 start ecosystem.config.js --only worker-retention-cleanup
 *
 * Manual Run:
 *   yarn cleanup:retention
 */

import { retentionConfig } from '@config/retention';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getRetentionStatus, runRetentionCleanup } from '@services/retention-cleanup';

let isShuttingDown = false;

/**
 * Cleanup function
 */
async function cleanup() {
    isShuttingDown = true;
    logger.info('🛑 Shutting down retention cleanup worker...');

    // Disconnect Prisma
    await prismaWorker.$disconnect();

    logger.info('✅ Retention cleanup worker stopped gracefully');
    process.exit(0);
}

/**
 * Log current retention status
 */
async function logRetentionStatus() {
    try {
        logger.info('📊 Checking current retention status...');
        const status = await getRetentionStatus();

        logger.info('');
        logger.info('═══════════════════════════════════════════════════');
        logger.info('📊 Current Retention Status');
        logger.info('═══════════════════════════════════════════════════');
        logger.info(`⏱️  Retention Period: ${retentionConfig.getRetentionPeriodText()} (${status.retentionDays} days)`);
        logger.info(`🗓️  Cutoff Date: ${status.cutoffDate.toISOString().split('T')[0]}`);
        logger.info('');

        status.tables.forEach(table => {
            logger.info(`📋 ${table.name}:`);
            logger.info(`   Total Rows: ${table.totalRows.toLocaleString()}`);
            logger.info(`   Old Rows (to delete): ${table.oldRows.toLocaleString()}`);
            if (table.oldestDate && table.newestDate) {
                logger.info(`   Date Range: ${table.oldestDate.toISOString().split('T')[0]} → ${table.newestDate.toISOString().split('T')[0]}`);
            }
            logger.info('');
        });

        logger.info('═══════════════════════════════════════════════════');
    } catch (error) {
        logger.error('❌ Error getting retention status:', error);
    }
}

/**
 * Main worker function - runs cleanup once and exits
 */
async function startRetentionCleanupWorker() {
    logger.info('🚀 Data Retention Cleanup Worker Starting...');
    logger.info(`⚙️  Configuration: Keep last ${retentionConfig.retentionDays} days (${retentionConfig.getRetentionPeriodText()})`);

    try {
        // Log current status before cleanup
        await logRetentionStatus();

        // Wait 5 seconds before starting cleanup
        await new Promise(resolve => setTimeout(resolve, 5000));

        if (isShuttingDown) {
            logger.info('⚠️ Shutdown requested, aborting cleanup');
            await cleanup();
            return;
        }

        // Run the cleanup
        await runRetentionCleanup();

        // Log status after cleanup
        await new Promise(resolve => setTimeout(resolve, 2000));
        logger.info('');
        logger.info('📊 Final Status After Cleanup:');
        await logRetentionStatus();

        logger.info('');
        logger.info('✅ Retention cleanup worker completed successfully');
        logger.info('💤 Worker will exit (managed by PM2 cron schedule)');

        // Exit gracefully (PM2 will restart on schedule)
        await cleanup();

    } catch (error) {
        logger.error('❌ Retention cleanup worker failed:', error);
        await prismaWorker.$disconnect();
        process.exit(1);
    }
}

// Graceful shutdown handlers
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start the worker
startRetentionCleanupWorker();
