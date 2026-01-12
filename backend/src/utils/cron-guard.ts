/**
 * Cron Guard - Prevents PM2 cron jobs from running on restart
 *
 * PM2's cron_restart triggers jobs immediately on restart/reload.
 * This guard checks if current time matches the expected cron schedule.
 */

interface CronSchedule {
    minute?: number;
    hour?: number;
    dayOfMonth?: number;
    dayOfWeek?: number;
}

/**
 * Checks if current UTC time matches the expected cron schedule
 * Returns true if job should run, false if it should skip
 *
 * @param schedule - Cron schedule configuration
 * @param gracePeriodMinutes - Allow execution within N minutes of target time (default: 5)
 *
 * Examples:
 *   shouldRunCronJob({ hour: 1, minute: 0 }) // Daily at 01:00 UTC
 *   shouldRunCronJob({ hour: 0, minute: 0, dayOfMonth: 1 }) // Monthly on 1st at 00:00 UTC
 *   shouldRunCronJob({ hour: 0, minute: 10, dayOfWeek: 0 }) // Sundays at 00:10 UTC
 */
export function shouldRunCronJob(
    schedule: CronSchedule,
    gracePeriodMinutes: number = 5
): boolean {
    const now = new Date();
    const currentMinute = now.getUTCMinutes();
    const currentHour = now.getUTCHours();
    const currentDayOfMonth = now.getUTCDate();
    const currentDayOfWeek = now.getUTCDay();

    // Check minute
    if (schedule.minute !== undefined) {
        const minuteDiff = Math.abs(currentMinute - schedule.minute);
        // Account for wrap-around (e.g., minute 58 vs minute 2)
        const adjustedDiff = Math.min(minuteDiff, 60 - minuteDiff);
        if (adjustedDiff > gracePeriodMinutes) {
            return false;
        }
    }

    // Check hour
    if (schedule.hour !== undefined && currentHour !== schedule.hour) {
        return false;
    }

    // Check day of month (if specified, takes precedence)
    if (schedule.dayOfMonth !== undefined && currentDayOfMonth !== schedule.dayOfMonth) {
        return false;
    }

    // Check day of week (0 = Sunday, 1 = Monday, etc.)
    if (schedule.dayOfWeek !== undefined && currentDayOfWeek !== schedule.dayOfWeek) {
        return false;
    }

    return true;
}

/**
 * Guard wrapper for cron jobs
 * Exits with code 0 if not the right time to run
 */
export function guardCronJob(
    jobName: string,
    schedule: CronSchedule,
    gracePeriodMinutes: number = 5
): void {
    if (!shouldRunCronJob(schedule, gracePeriodMinutes)) {
        const now = new Date().toISOString();
        console.log(`[${now}] ${jobName}: Not scheduled to run at this time. Skipping.`);
        process.exit(0);
    }
}
