/**
 * Daily Orchestrator Worker
 *
 * Manages the daily workflow for updating all EVE Online alliances and corporations.
 *
 * Workflow:
 * 1. Queue all alliance IDs from ESI
 * 2. Wait for alliance info worker to process them
 * 3. Queue alliance corporations discovery
 * 4. Wait for alliance-corporations worker to process
 * 5. Wait for corporation info worker to process
 * 6. Take alliance snapshot
 * 7. Take corporation snapshot
 *
 * Usage:
 * - Automatic: yarn worker:daily-orchestrator (runs daily at 02:00)
 * - Manual: yarn worker:daily-orchestrator --manual (runs immediately)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../services/logger';

const execAsync = promisify(exec);

const WORKER_NAME = 'daily-orchestrator';
const SCHEDULE_HOUR = 2; // 02:00 UTC
const CHECK_INTERVAL = 30000; // 30 seconds

interface QueueStats {
  messageCount: number;
  consumerCount: number;
}

async function runCommand(command: string): Promise<void> {
  logger.info(`[${WORKER_NAME}] Running: ${command}`);
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
    });
    if (stdout) logger.debug(stdout.trim());
    if (stderr) logger.warn(stderr.trim());
  } catch (error: any) {
    logger.error(`[${WORKER_NAME}] Command failed:`, error.message);
    throw error;
  }
}

async function getQueueCount(queueName: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `yarn rabbitmq:queue-count ${queueName}`,
      { cwd: process.cwd() }
    );
    return parseInt(stdout.trim()) || 0;
  } catch (error) {
    logger.error(`[${WORKER_NAME}] Failed to get queue count for ${queueName}:`, error);
    throw error;
  }
}

async function waitForQueueEmpty(
  queueName: string,
  timeoutMinutes: number = 60
): Promise<void> {
  logger.info(`[${WORKER_NAME}] Waiting for ${queueName} to empty (max ${timeoutMinutes}min)...`);

  const startTime = Date.now();
  const timeout = timeoutMinutes * 60 * 1000;
  let lastCount = -1;

  while (Date.now() - startTime < timeout) {
    const count = await getQueueCount(queueName);

    if (count === 0) {
      logger.info(`[${WORKER_NAME}] ✅ Queue ${queueName} is empty!`);
      return;
    }

    // Only log if count changed significantly or every 5 minutes
    const elapsed = Date.now() - startTime;
    if (count !== lastCount || elapsed % (5 * 60 * 1000) < CHECK_INTERVAL) {
      logger.info(`[${WORKER_NAME}] Queue ${queueName}: ${count} messages remaining...`);
      lastCount = count;
    }

    await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL));
  }

  throw new Error(
    `Timeout: Queue ${queueName} did not empty in ${timeoutMinutes} minutes`
  );
}

async function runDailyWorkflow(): Promise<void> {
  const startTime = Date.now();
  logger.info(`[${WORKER_NAME}] ═══════════════════════════════════════════════`);
  logger.info(`[${WORKER_NAME}] 🚀 Starting daily workflow...`);
  logger.info(`[${WORKER_NAME}] ═══════════════════════════════════════════════`);

  try {
    // Step 1: Queue all alliance IDs
    logger.info(`[${WORKER_NAME}] Step 1/7: Queueing alliance IDs...`);
    await runCommand('yarn queue:alliances');
    logger.info(`[${WORKER_NAME}] ✅ Alliance IDs queued`);

    // Step 2: Wait for alliance info worker
    logger.info(`[${WORKER_NAME}] Step 2/7: Processing alliance info...`);
    await waitForQueueEmpty('esi_alliance_info_queue', 30);
    logger.info(`[${WORKER_NAME}] ✅ Alliance info updated (~3,547 alliances)`);

    // Step 3: Queue alliance corporations
    logger.info(`[${WORKER_NAME}] Step 3/7: Queueing alliance corporations discovery...`);
    await runCommand('yarn queue:alliance-corporations');
    logger.info(`[${WORKER_NAME}] ✅ Alliance corporations queued`);

    // Step 4: Wait for alliance-corporations worker
    logger.info(`[${WORKER_NAME}] Step 4/7: Discovering corporation IDs...`);
    await waitForQueueEmpty('esi_alliance_corporations_queue', 60);
    logger.info(`[${WORKER_NAME}] ✅ Corporation IDs queued`);

    // Step 5: Wait for corporation info worker
    logger.info(`[${WORKER_NAME}] Step 5/7: Processing corporation info...`);
    await waitForQueueEmpty('esi_corporation_info_queue', 90);
    logger.info(`[${WORKER_NAME}] ✅ Corporation info updated (~17,769 corporations)`);

    // Step 6: Alliance snapshot
    logger.info(`[${WORKER_NAME}] Step 6/7: Taking alliance snapshot...`);
    await runCommand('yarn snapshot:alliances');
    logger.info(`[${WORKER_NAME}] ✅ Alliance snapshot saved`);

    // Step 7: Corporation snapshot
    logger.info(`[${WORKER_NAME}] Step 7/7: Taking corporation snapshot...`);
    await runCommand('yarn snapshot:corporations');
    logger.info(`[${WORKER_NAME}] ✅ Corporation snapshot saved`);

    const duration = Math.round((Date.now() - startTime) / 1000 / 60);
    logger.info(`[${WORKER_NAME}] ═══════════════════════════════════════════════`);
    logger.info(`[${WORKER_NAME}] 🎉 Daily workflow completed successfully!`);
    logger.info(`[${WORKER_NAME}] Total duration: ${duration} minutes`);
    logger.info(`[${WORKER_NAME}] ═══════════════════════════════════════════════`);
  } catch (error: any) {
    const duration = Math.round((Date.now() - startTime) / 1000 / 60);
    logger.error(`[${WORKER_NAME}] ═══════════════════════════════════════════════`);
    logger.error(`[${WORKER_NAME}] ❌ Daily workflow failed after ${duration} minutes`);
    logger.error(`[${WORKER_NAME}] Error:`, error.message);
    logger.error(`[${WORKER_NAME}] ═══════════════════════════════════════════════`);
    throw error;
  }
}

function scheduleDaily(): void {
  const now = new Date();
  const scheduledTime = new Date();
  scheduledTime.setHours(SCHEDULE_HOUR, 0, 0, 0);

  // If today's scheduled time has passed, schedule for tomorrow
  if (scheduledTime <= now) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
  }

  const delay = scheduledTime.getTime() - now.getTime();
  const hours = Math.floor(delay / 1000 / 60 / 60);
  const minutes = Math.floor((delay / 1000 / 60) % 60);

  logger.info(`[${WORKER_NAME}] Next run scheduled at: ${scheduledTime.toISOString()}`);
  logger.info(`[${WORKER_NAME}] Time until next run: ${hours}h ${minutes}m`);

  setTimeout(async () => {
    try {
      await runDailyWorkflow();
    } catch (error) {
      logger.error(`[${WORKER_NAME}] Workflow failed, will retry tomorrow`);
    }

    // Schedule next run
    scheduleDaily();
  }, delay);
}

// Main entry point
async function main() {
  const isManual = process.argv.includes('--manual');

  logger.info(`[${WORKER_NAME}] Starting daily orchestrator...`);
  logger.info(`[${WORKER_NAME}] Mode: ${isManual ? 'MANUAL (immediate)' : 'AUTOMATIC (scheduled)'}`);

  if (isManual) {
    // Manual mode: run immediately and exit
    logger.info(`[${WORKER_NAME}] Running workflow immediately...`);
    try {
      await runDailyWorkflow();
      logger.info(`[${WORKER_NAME}] Manual workflow completed. Exiting.`);
      process.exit(0);
    } catch (error) {
      logger.error(`[${WORKER_NAME}] Manual workflow failed. Exiting.`);
      process.exit(1);
    }
  } else {
    // Automatic mode: schedule and keep running
    scheduleDaily();
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info(`[${WORKER_NAME}] Received SIGINT, shutting down gracefully...`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info(`[${WORKER_NAME}] Received SIGTERM, shutting down gracefully...`);
  process.exit(0);
});

// Start orchestrator
main().catch((error) => {
  logger.error(`[${WORKER_NAME}] Fatal error:`, error);
  process.exit(1);
});
