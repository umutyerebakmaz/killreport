/**
 * Data Retention Cleanup Service
 *
 * Removes old data from aggregated tables to optimize storage and performance.
 * Base data (killmails, characters, corporations, alliances) is preserved.
 *
 * Cleaned tables:
 * - daily_pilot_kills
 * - daily_corporation_kills
 * - daily_alliance_kills
 *
 * NOT cleaned (critical for performance):
 * - killmail_filters (essential cache table for queries)
 *
 * Strategy:
 * - Runs weekly (Sunday 2 AM UTC)
 * - Uses configurable retention period (default: 180 days / 6 months)
 * - Deletes in batches to avoid long locks
 * - Logs detailed statistics
 */

import { retentionConfig } from '@config/retention';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';

interface CleanupStats {
  tableName: string;
  deletedCount: number;
  durationMs: number;
  error?: string;
}

/**
 * Clean up old data from a specific table
 */
async function cleanupTable(
  tableName: string,
  dateColumn: string
): Promise<CleanupStats> {
  const startTime = Date.now();
  const cutoffDate = retentionConfig.getCutoffDate();

  try {
    logger.info(`🧹 Cleaning ${tableName} (data older than ${cutoffDate.toISOString()})...`);

    // First, check how many rows will be deleted
    const countResult = await prismaWorker.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM ${tableName} WHERE ${dateColumn} < $1`,
      cutoffDate
    );

    const rowsToDelete = Number(countResult[0]?.count || 0);

    if (rowsToDelete === 0) {
      logger.info(`✨ ${tableName}: No data to clean up`);
      return {
        tableName,
        deletedCount: 0,
        durationMs: Date.now() - startTime,
      };
    }

    logger.info(`📊 ${tableName}: Found ${rowsToDelete.toLocaleString()} rows to delete`);

    // Delete old data
    const result = await prismaWorker.$executeRawUnsafe(
      `DELETE FROM ${tableName} WHERE ${dateColumn} < $1`,
      cutoffDate
    );

    const duration = Date.now() - startTime;
    logger.info(`✅ ${tableName}: Deleted ${rowsToDelete.toLocaleString()} rows in ${duration}ms`);

    return {
      tableName,
      deletedCount: rowsToDelete,
      durationMs: duration,
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`❌ Error cleaning ${tableName} after ${duration}ms:`, error);
    return {
      tableName,
      deletedCount: 0,
      durationMs: duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run full retention cleanup across all aggregated tables
 */
export async function runRetentionCleanup(): Promise<void> {
  const startTime = Date.now();
  const cutoffDate = retentionConfig.getCutoffDate();

  logger.info('🚀 Starting Data Retention Cleanup Process...');
  logger.info(`📅 Retention Period: ${retentionConfig.getRetentionPeriodText()} (${retentionConfig.retentionDays} days)`);
  logger.info(`🗓️  Cutoff Date: ${cutoffDate.toISOString()}`);
  logger.info(`ℹ️  Data older than this date will be deleted from aggregated tables`);

  const stats: CleanupStats[] = [];

  try {
    // 1. Clean daily_pilot_kills
    stats.push(await cleanupTable('daily_pilot_kills', 'kill_date'));

    // Small delay between operations
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 2. Clean daily_corporation_kills
    stats.push(await cleanupTable('daily_corporation_kills', 'kill_date'));

    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Clean daily_alliance_kills
    stats.push(await cleanupTable('daily_alliance_kills', 'kill_date'));

    // NOTE: killmail_filters is NOT cleaned - it's a critical cache table
    // that would take hours to rebuild and is essential for query performance

    // Log summary
    const totalDuration = Date.now() - startTime;
    const totalDeleted = stats.reduce((sum, stat) => sum + stat.deletedCount, 0);
    const errors = stats.filter(stat => stat.error);

    logger.info('');
    logger.info('═══════════════════════════════════════════════════');
    logger.info('📊 Retention Cleanup Summary');
    logger.info('═══════════════════════════════════════════════════');

    stats.forEach(stat => {
      if (stat.error) {
        logger.error(`❌ ${stat.tableName}: ERROR - ${stat.error}`);
      } else if (stat.deletedCount === 0) {
        logger.info(`✨ ${stat.tableName}: No cleanup needed`);
      } else {
        logger.info(`✅ ${stat.tableName}: ${stat.deletedCount.toLocaleString()} rows deleted (${stat.durationMs}ms)`);
      }
    });

    logger.info('');
    logger.info(`🎯 Total Rows Deleted: ${totalDeleted.toLocaleString()}`);
    logger.info(`⏱️  Total Duration: ${totalDuration}ms (${Math.round(totalDuration / 1000)}s)`);

    if (errors.length > 0) {
      logger.warn(`⚠️  Completed with ${errors.length} error(s)`);
    } else {
      logger.info('✅ Retention cleanup completed successfully');
    }
    logger.info('═══════════════════════════════════════════════════');

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`❌ Retention cleanup failed after ${duration}ms:`, error);
    throw error;
  }
}

/**
 * Get retention status (how much data we have, what will be cleaned)
 */
export async function getRetentionStatus(): Promise<{
  retentionDays: number;
  cutoffDate: Date;
  tables: Array<{
    name: string;
    totalRows: number;
    oldRows: number;
    oldestDate: Date | null;
    newestDate: Date | null;
  }>;
}> {
  const cutoffDate = retentionConfig.getCutoffDate();

  const tables = [
    { name: 'daily_pilot_kills', dateColumn: 'kill_date' },
    { name: 'daily_corporation_kills', dateColumn: 'kill_date' },
    { name: 'daily_alliance_kills', dateColumn: 'kill_date' },
    // killmail_filters is excluded - it's a critical cache table
  ];

  const results = await Promise.all(
    tables.map(async ({ name, dateColumn }) => {
      const [totalCount, oldCount, dateRange] = await Promise.all([
        prismaWorker.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT COUNT(*) as count FROM ${name}`
        ),
        prismaWorker.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT COUNT(*) as count FROM ${name} WHERE ${dateColumn} < $1`,
          cutoffDate
        ),
        prismaWorker.$queryRawUnsafe<Array<{ oldest: Date | null; newest: Date | null }>>(
          `SELECT MIN(${dateColumn}) as oldest, MAX(${dateColumn}) as newest FROM ${name}`
        ),
      ]);

      return {
        name,
        totalRows: Number(totalCount[0]?.count || 0),
        oldRows: Number(oldCount[0]?.count || 0),
        oldestDate: dateRange[0]?.oldest || null,
        newestDate: dateRange[0]?.newest || null,
      };
    })
  );

  return {
    retentionDays: retentionConfig.retentionDays,
    cutoffDate,
    tables: results,
  };
}
