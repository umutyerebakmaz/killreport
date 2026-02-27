#!/usr/bin/env ts-node

/**
 * Manual Retention Cleanup Script
 *
 * Run this script manually to clean up old data without waiting for scheduled worker.
 *
 * Usage:
 *   yarn cleanup:retention
 *   OR
 *   ts-node backend/cleanup-retention.ts
 *
 * Configuration:
 *   Set RETENTION_DAYS in .env file (default: 180 days / 6 months)
 *
 * What gets cleaned:
 *   - daily_pilot_kills (older than retention period)
 *   - daily_corporation_kills (older than retention period)
 *   - daily_alliance_kills (older than retention period)
 *
 * What is preserved:
 *   - Base killmails data
 *   - killmail_filters (critical cache table)
 *   - Characters, corporations, alliances
 *   - All static game data
 */

import { retentionConfig } from './src/config/retention';
import logger from './src/services/logger';
import prismaWorker from './src/services/prisma-worker';
import { getRetentionStatus, runRetentionCleanup } from './src/services/retention-cleanup';

async function main() {
    logger.info('🚀 Manual Retention Cleanup Started');
    logger.info(`⚙️  Configuration: Keep last ${retentionConfig.retentionDays} days (${retentionConfig.getRetentionPeriodText()})`);
    logger.info('');

    try {
        // Show current status
        logger.info('📊 Checking current status...');
        const statusBefore = await getRetentionStatus();

        logger.info('');
        logger.info('═══════════════════════════════════════════════════');
        logger.info('📊 Current Status (Before Cleanup)');
        logger.info('═══════════════════════════════════════════════════');
        logger.info(`⏱️  Retention Period: ${retentionConfig.getRetentionPeriodText()} (${statusBefore.retentionDays} days)`);
        logger.info(`🗓️  Cutoff Date: ${statusBefore.cutoffDate.toISOString().split('T')[0]}`);
        logger.info('');

        let totalOldRows = 0;
        statusBefore.tables.forEach(table => {
            logger.info(`📋 ${table.name}:`);
            logger.info(`   Total: ${table.totalRows.toLocaleString()} rows`);
            logger.info(`   Will Delete: ${table.oldRows.toLocaleString()} rows`);
            totalOldRows += table.oldRows;
            logger.info('');
        });

        logger.info(`🗑️  Total Rows to Delete: ${totalOldRows.toLocaleString()}`);
        logger.info('═══════════════════════════════════════════════════');
        logger.info('');

        if (totalOldRows === 0) {
            logger.info('✨ No data to clean up. Everything is within retention period.');
            await prismaWorker.$disconnect();
            process.exit(0);
        }

        // Confirm and wait
        logger.info('⏳ Starting cleanup in 3 seconds...');
        logger.info('   (Press Ctrl+C to cancel)');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Run cleanup
        await runRetentionCleanup();

        logger.info('');
        logger.info('✅ Manual retention cleanup completed successfully');

    } catch (error) {
        logger.error('❌ Manual retention cleanup failed:', error);
        await prismaWorker.$disconnect();
        process.exit(1);
    }

    await prismaWorker.$disconnect();
    process.exit(0);
}

// Handle interruption
process.on('SIGINT', async () => {
    logger.info('\n⚠️  Cleanup interrupted by user');
    await prismaWorker.$disconnect();
    process.exit(0);
});

main();
