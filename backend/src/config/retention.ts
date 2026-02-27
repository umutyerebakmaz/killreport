/**
 * Data Retention Configuration
 *
 * Configure how long different types of data should be kept in the database.
 * This helps manage database size and performance over time.
 *
 * Usage:
 *   - Set RETENTION_DAYS in .env file (default: 365 days / 1 year)
 *   - Worker runs weekly (Sunday 2 AM UTC) via PM2 cron
 *   - Can be run manually: yarn cleanup:retention
 */

import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Retention configuration schema
const retentionSchema = z.object({
  // Data retention in days
  RETENTION_DAYS: z.string()
    .default('365')  // Changed: 1 year default (was 180)
    .transform(Number)
    .refine(val => val >= 180, 'RETENTION_DAYS must be at least 180 days for data integrity'),  // Changed: 180 min (was 90)
});

// Parse retention config
const parseRetentionConfig = () => {
  try {
    return retentionSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('⚠️  Retention configuration warning:');
      error.issues.forEach((issue) => {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      });
      console.error('  Using default: 365 days (1 year)');
      return { RETENTION_DAYS: 365 };
    }
    throw error;
  }
};

const retentionEnv = parseRetentionConfig();

/**
 * Retention configuration
 */
export const retentionConfig = {
  /**
   * How many days of data to keep (default: 365 days / 1 year)
   *
   * Older data will be deleted during cleanup runs:
   * - daily_pilot_kills
   * - daily_corporation_kills
   * - daily_alliance_kills
   *
   * NOT deleted (critical for performance):
   * - killmail_filters (essential cache table)
   *
   * Note: Base killmails, characters, corporations, alliances are NOT deleted.
   * Only the daily aggregation tables are cleaned up.
   */
  retentionDays: retentionEnv.RETENTION_DAYS,

  /**
   * Get cutoff date for retention cleanup
   */
  getCutoffDate(): Date {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retentionDays);
    cutoff.setUTCHours(0, 0, 0, 0); // Start of day
    return cutoff;
  },

  /**
   * Human readable retention period
   */
  getRetentionPeriodText(): string {
    const days = this.retentionDays;
    if (days >= 365) {
      const years = Math.floor(days / 365);
      return `${years} year${years > 1 ? 's' : ''}`;
    } else if (days >= 30) {
      const months = Math.floor(days / 30);
      return `${months} month${months > 1 ? 's' : ''}`;
    } else {
      return `${days} day${days > 1 ? 's' : ''}`;
    }
  },
} as const;

export type RetentionConfig = typeof retentionConfig;
