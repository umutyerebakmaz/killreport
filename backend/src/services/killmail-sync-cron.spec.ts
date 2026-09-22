import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The scheduled publisher behind both ESI killmail queues.
 *
 * `queue-health` is deliberately NOT mocked: the back-pressure rule is its
 * `skipReason`, and a test that stubbed it would assert the stub rather than
 * the rule. The broker numbers it reads are what these tests vary.
 */

const { prismaMock, getQueueStats, getRabbitMQChannel, channel, loggerMock } =
  vi.hoisted(() => {
    const channel = { sendToQueue: vi.fn() };
    return {
      channel,
      prismaMock: { user: { findMany: vi.fn() } },
      getQueueStats: vi.fn(),
      getRabbitMQChannel: vi.fn(async () => channel),
      loggerMock: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    };
  });

vi.mock('./prisma', () => ({ default: prismaMock }));
vi.mock('./rabbitmq', () => ({ getQueueStats, getRabbitMQChannel }));
vi.mock('@services/logger', () => ({ default: loggerMock }));

import {
  CORPORATION_SYNC_JOB,
  KillmailSyncCron,
  USER_SYNC_JOB,
} from './killmail-sync-cron';

/** A queue with a worker on it and nothing waiting: publishing is allowed. */
const HEALTHY = { messageCount: 0, consumerCount: 1 };

function user(id: number, name = `Pilot ${id}`) {
  return {
    id,
    character_id: 90000000 + id,
    character_name: name,
    corporation_id: 98000001,
    expires_at: new Date('2026-09-23T00:00:00Z'),
    last_killmail_sync_at: null,
    last_corp_killmail_sync_at: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getQueueStats.mockResolvedValue(HEALTHY);
  prismaMock.user.findMany.mockResolvedValue([]);
});

describe('publishing', () => {
  it('queues one message per user, on the jobs queue and priority', async () => {
    prismaMock.user.findMany.mockResolvedValue([user(1), user(2)]);

    await new KillmailSyncCron(CORPORATION_SYNC_JOB).runOnce();

    expect(channel.sendToQueue).toHaveBeenCalledTimes(2);
    const [queue, content, options] = channel.sendToQueue.mock.calls[0];
    expect(queue).toBe('esi_corporation_killmails_queue');
    expect(JSON.parse(content.toString()).userId).toBe(1);
    expect(options).toMatchObject({
      persistent: true,
      priority: CORPORATION_SYNC_JOB.priority,
    });
  });

  it('carries no credentials in the message body', async () => {
    prismaMock.user.findMany.mockResolvedValue([user(1)]);

    await new KillmailSyncCron(USER_SYNC_JOB).runOnce();

    const body = JSON.parse(channel.sendToQueue.mock.calls[0][1].toString());
    expect(Object.keys(body)).not.toContain('accessToken');
    expect(Object.keys(body)).not.toContain('refreshToken');
  });
});

describe('the job decides who is asked for', () => {
  it('the corporation job wants a corporation and its own timestamp', async () => {
    await new KillmailSyncCron(CORPORATION_SYNC_JOB).runOnce();

    const { where } = prismaMock.user.findMany.mock.calls[0][0];
    expect(where.corporation_id).toEqual({ not: null });
    expect(where.OR).toEqual([
      { last_corp_killmail_sync_at: null },
      { last_corp_killmail_sync_at: { lt: expect.any(Date) } },
    ]);
  });

  it('the user job asks for everyone with a live token', async () => {
    await new KillmailSyncCron(USER_SYNC_JOB).runOnce();

    const { where } = prismaMock.user.findMany.mock.calls[0][0];
    expect(where.corporation_id).toBeUndefined();
    expect(where.OR).toEqual([
      { last_killmail_sync_at: null },
      { last_killmail_sync_at: { lt: expect.any(Date) } },
    ]);
    expect(where.refresh_token).toEqual({ not: null });
  });
});

describe('back-pressure', () => {
  it('publishes nothing while no worker is consuming', async () => {
    getQueueStats.mockResolvedValue({ messageCount: 0, consumerCount: 0 });
    prismaMock.user.findMany.mockResolvedValue([user(1)]);

    await new KillmailSyncCron(CORPORATION_SYNC_JOB).runOnce();

    expect(channel.sendToQueue).not.toHaveBeenCalled();
    // The database is not read either: the decision is made before the query.
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it('publishes nothing while the queue still holds messages', async () => {
    getQueueStats.mockResolvedValue({ messageCount: 3, consumerCount: 1 });
    prismaMock.user.findMany.mockResolvedValue([user(1)]);

    await new KillmailSyncCron(CORPORATION_SYNC_JOB).runOnce();

    expect(channel.sendToQueue).not.toHaveBeenCalled();
  });

  it('asks about its own queue, not the other jobs', async () => {
    await new KillmailSyncCron(USER_SYNC_JOB).runOnce();

    expect(getQueueStats).toHaveBeenCalledWith('esi_user_killmails_queue');
  });
});

describe('overlapping runs', () => {
  it('skips a tick while the previous one is still going', async () => {
    let release!: (rows: unknown[]) => void;
    prismaMock.user.findMany.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const cron = new KillmailSyncCron(CORPORATION_SYNC_JOB);

    const first = cron.runOnce();
    // Wait for the first run to actually reach the query it will hang on,
    // rather than assuming how many awaits precede it.
    await vi.waitFor(() =>
      expect(prismaMock.user.findMany).toHaveBeenCalledTimes(1),
    );

    await cron.runOnce();

    expect(prismaMock.user.findMany).toHaveBeenCalledTimes(1);

    release([]);
    await first;

    // The guard lifts once the run finishes, or one stuck tick would stop
    // the cron for the life of the process.
    await cron.runOnce();
    expect(prismaMock.user.findMany).toHaveBeenCalledTimes(2);
  });

  it('lifts the guard when a run throws', async () => {
    prismaMock.user.findMany.mockRejectedValueOnce(new Error('database down'));
    const cron = new KillmailSyncCron(CORPORATION_SYNC_JOB);

    await cron.runOnce();
    await cron.runOnce();

    expect(prismaMock.user.findMany).toHaveBeenCalledTimes(2);
  });
});

describe('the two jobs', () => {
  it('name different queues and different timestamp columns', () => {
    expect(USER_SYNC_JOB.queue).toBe('esi_user_killmails_queue');
    expect(CORPORATION_SYNC_JOB.queue).toBe('esi_corporation_killmails_queue');
    expect(USER_SYNC_JOB.sinceField).toBe('last_killmail_sync_at');
    expect(CORPORATION_SYNC_JOB.sinceField).toBe('last_corp_killmail_sync_at');
  });
});

describe('a user who has never been synced', () => {
  it('is queued for a full sync, not an incremental one', async () => {
    // The incremental cursor is MAX(killmail_id) over killmail_filters, and
    // that table is written by every source — RedisQ stores the whole of EVE.
    // So a brand new user usually already has one killmail there, the ESI list
    // stops on it at index 0, and their history is never backfilled.
    prismaMock.user.findMany.mockResolvedValue([
      { ...user(1), last_killmail_sync_at: null },
    ]);

    await new KillmailSyncCron(USER_SYNC_JOB).runOnce();

    const body = JSON.parse(channel.sendToQueue.mock.calls[0][1].toString());
    expect(body.fullSync).toBe(true);
  });

  it('leaves an already-synced user incremental', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { ...user(1), last_killmail_sync_at: new Date('2026-09-01T00:00:00Z') },
    ]);

    await new KillmailSyncCron(USER_SYNC_JOB).runOnce();

    const body = JSON.parse(channel.sendToQueue.mock.calls[0][1].toString());
    expect(body.fullSync).toBeUndefined();
  });

  it('reads the corporation job’s own timestamp', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        ...user(1),
        last_killmail_sync_at: new Date('2026-09-01T00:00:00Z'),
        last_corp_killmail_sync_at: null,
      },
    ]);

    await new KillmailSyncCron(CORPORATION_SYNC_JOB).runOnce();

    const body = JSON.parse(channel.sendToQueue.mock.calls[0][1].toString());
    expect(body.fullSync).toBe(true);
  });
});

describe('the queue the work actually lands in', () => {
  it('holds off when the detail queue has no consumer', async () => {
    // The list stages drain their own queue in seconds now; the backlog lives
    // in esi_killmail_detail_queue. Publishing against a stalled detail queue
    // re-lists from ESI and re-publishes everything not yet written.
    getQueueStats.mockImplementation(async (queue: string) =>
      queue === 'esi_killmail_detail_queue'
        ? { messageCount: 0, consumerCount: 0 }
        : HEALTHY,
    );
    prismaMock.user.findMany.mockResolvedValue([user(1)]);

    await new KillmailSyncCron(USER_SYNC_JOB).runOnce();

    expect(channel.sendToQueue).not.toHaveBeenCalled();
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it('holds off when the detail queue is still full', async () => {
    getQueueStats.mockImplementation(async (queue: string) =>
      queue === 'esi_killmail_detail_queue'
        ? { messageCount: 4000, consumerCount: 1 }
        : HEALTHY,
    );

    await new KillmailSyncCron(USER_SYNC_JOB).runOnce();

    expect(channel.sendToQueue).not.toHaveBeenCalled();
  });
});
