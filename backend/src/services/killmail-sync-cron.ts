import { buildSyncMessage } from '@services/killmail-sync-message';
import logger from '@services/logger';
import prisma from './prisma';
import { skipReason } from './queue-health';
import { getQueueStats, getRabbitMQChannel } from './rabbitmq';

/** How often a tick runs. */
const SYNC_INTERVAL_MINUTES = 10;

/** How long a user's last sync may be before they are queued again. */
const STALE_AFTER_MINUTES = 15;

/**
 * How much life a token must have left to be worth queueing. The worker
 * refreshes an expiring token itself (`user-credentials.ts`), so this only
 * keeps the queue free of users whose session has clearly lapsed.
 */
const TOKEN_BUFFER_MINUTES = 5;

/**
 * One scheduled sync: which queue it feeds, which users it is about, and
 * which column records that they were synced.
 *
 * Both killmail queues are fed the same way — ask the broker whether it wants
 * more, select the users whose sync has gone stale, publish one message each.
 * The only differences are in here, which is why there is one class rather
 * than two files that drift apart the next time the publishing rule changes
 * (see #237, a fix that would otherwise have had to be made twice).
 */
export interface SyncJob {
  /** Names this job in the log. */
  label: string;
  queue: string;
  sinceField: 'last_killmail_sync_at' | 'last_corp_killmail_sync_at';
  /**
   * Corporation killmails are read through a user's corporation, so a user
   * without one has nothing to sync.
   */
  requiresCorporation: boolean;
  /** Background work yields to anything a person is waiting on. */
  priority: number;
}

export const USER_SYNC_JOB: SyncJob = {
  label: 'user killmails',
  queue: 'esi_user_killmails_queue',
  sinceField: 'last_killmail_sync_at',
  requiresCorporation: false,
  priority: 3,
};

export const CORPORATION_SYNC_JOB: SyncJob = {
  label: 'corporation killmails',
  queue: 'esi_corporation_killmails_queue',
  sinceField: 'last_corp_killmail_sync_at',
  requiresCorporation: true,
  priority: 3,
};

/**
 * Publishes one sync job on an interval, from inside the API server.
 *
 * The durable record of outstanding work is the database — the `sinceField`
 * column — not the queue, so a tick missed while the process was down costs
 * nothing: the next one selects the same users.
 */
export class KillmailSyncCron {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private readonly job: SyncJob) {}

  async start(): Promise<void> {
    if (this.intervalId) {
      logger.warn(`⚠️  ${this.job.label} cron is already running`);
      return;
    }

    logger.info(
      `🕐 ${this.job.label} sync: every ${SYNC_INTERVAL_MINUTES} minutes → ${this.job.queue}`,
    );

    await this.runOnce();

    this.intervalId = setInterval(
      () => this.runOnce(),
      SYNC_INTERVAL_MINUTES * 60 * 1000,
    );
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info(`🛑 ${this.job.label} cron stopped`);
    }
  }

  /** One pass. Public so a tick can be driven directly in a test. */
  async runOnce(): Promise<void> {
    if (this.isRunning) {
      logger.debug(
        `⏭️  ${this.job.label}: previous run still in progress, skipping`,
      );
      return;
    }

    this.isRunning = true;

    try {
      // Ask the broker before adding to it. getQueueStats uses its own
      // monitoring channel and answers zeros when the queue is missing or the
      // broker is unreachable, which reads as "no consumer" and holds off —
      // an unreadable broker is not a reason to publish blindly.
      const reason = skipReason(await getQueueStats(this.job.queue));
      if (reason) {
        logger.debug(`⏭️  ${this.job.label}: skipping - ${reason}`);
        return;
      }

      const users = await this.usersDue();
      if (users.length === 0) {
        logger.debug(`ℹ️  ${this.job.label}: nobody is due`);
        return;
      }

      const channel = await getRabbitMQChannel();
      for (const user of users) {
        channel.sendToQueue(
          this.job.queue,
          Buffer.from(JSON.stringify(buildSyncMessage(user.id))),
          { persistent: true, priority: this.job.priority },
        );
        logger.debug(
          `⏳ ${this.job.label}: queued ${user.character_name} (${user.character_id})`,
        );
      }

      logger.info(`✅ ${this.job.label}: queued ${users.length} user(s)`);
    } catch (error) {
      logger.error(`❌ ${this.job.label}: sync failed`, error);
    } finally {
      this.isRunning = false;
    }
  }

  getStatus() {
    return {
      job: this.job.label,
      queue: this.job.queue,
      isActive: !!this.intervalId,
      isRunning: this.isRunning,
      intervalMinutes: SYNC_INTERVAL_MINUTES,
    };
  }

  /** Users with a live session whose last sync for this job has gone stale. */
  private async usersDue() {
    const tokenAliveUntil = new Date(
      Date.now() + TOKEN_BUFFER_MINUTES * 60 * 1000,
    );
    const staleBefore = new Date(Date.now() - STALE_AFTER_MINUTES * 60 * 1000);

    // Written out per job rather than through a computed key, so the column
    // names stay visible to Prisma's types.
    const stale =
      this.job.sinceField === 'last_corp_killmail_sync_at'
        ? [
            { last_corp_killmail_sync_at: null },
            { last_corp_killmail_sync_at: { lt: staleBefore } },
          ]
        : [
            { last_killmail_sync_at: null },
            { last_killmail_sync_at: { lt: staleBefore } },
          ];

    return prisma.user.findMany({
      where: {
        expires_at: { gt: tokenAliveUntil },
        refresh_token: { not: null },
        ...(this.job.requiresCorporation
          ? { corporation_id: { not: null } }
          : {}),
        OR: stale,
      },
      select: {
        id: true,
        character_id: true,
        character_name: true,
        corporation_id: true,
        expires_at: true,
        last_killmail_sync_at: true,
        last_corp_killmail_sync_at: true,
      },
    });
  }
}

export const userKillmailCron = new KillmailSyncCron(USER_SYNC_JOB);
export const corporationKillmailCron = new KillmailSyncCron(
  CORPORATION_SYNC_JOB,
);
