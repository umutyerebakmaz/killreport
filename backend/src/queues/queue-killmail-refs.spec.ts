import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The publisher feeds esi_killmail_detail_queue from killmail_refs: refs with
 * no killmail yet, first right away, then hourly for five rounds, then daily.
 * Counters move only after the broker confirmed the messages, and nothing is
 * spent while the detail worker is down.
 */

const { prisma, channel, getQueueStats } = vi.hoisted(() => ({
  prisma: { $queryRaw: vi.fn(), $executeRaw: vi.fn(), $disconnect: vi.fn() },
  channel: {
    sendToQueue: vi.fn(),
    waitForConfirms: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  },
  getQueueStats: vi.fn(),
}));

vi.mock('@services/prisma-worker', () => ({ default: prisma }));
vi.mock('@services/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@services/rabbitmq', () => ({
  ensureAllQueuesExist: vi.fn(),
  getQueueStats,
  getRabbitMQConfirmChannel: vi.fn(async () => channel),
}));

import { publishPendingRefs } from './queue-killmail-refs';

const NOW = new Date('2026-11-26T10:00:00.000Z');

beforeEach(() => {
  vi.clearAllMocks();
  getQueueStats.mockResolvedValue({
    messageCount: 0,
    consumerCount: 1,
    exists: true,
  });
  channel.waitForConfirms.mockResolvedValue(undefined);
  prisma.$queryRaw.mockResolvedValue([
    { killmail_id: 2, killmail_hash: 'b' },
    { killmail_id: 1, killmail_hash: 'a' },
  ]);
});

describe('publishPendingRefs', () => {
  it('no_consumer_skips_the_tick', async () => {
    getQueueStats.mockResolvedValue({
      messageCount: 0,
      consumerCount: 0,
      exists: true,
    });

    expect(await publishPendingRefs(NOW)).toBe(0);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(channel.sendToQueue).not.toHaveBeenCalled();
  });

  it('selects pending refs by the three retry rules, newest first', async () => {
    await publishPendingRefs(NOW);

    const [sql, ...params] = prisma.$queryRaw.mock.calls[0];
    const text = sql.join('?');
    expect(text).toMatch(/NOT EXISTS \(SELECT 1 FROM killmails/);
    expect(text).toMatch(/last_queued_at IS NULL/);
    expect(text).toMatch(/queued_count < 5/);
    expect(text).toMatch(/queued_count >= 5/);
    expect(text).toMatch(/ORDER BY r\.killmail_id DESC/);
    expect(text).toMatch(/LIMIT 5000/);
    expect(params).toEqual([
      '2026-11-26 09:00:00.000',
      '2026-11-25 10:00:00.000',
    ]);
  });

  it('publishes each pending ref unannounced at priority 5', async () => {
    expect(await publishPendingRefs(NOW)).toBe(2);

    expect(channel.sendToQueue).toHaveBeenCalledTimes(2);
    const [queue, body, options] = channel.sendToQueue.mock.calls[0];
    expect(queue).toBe('esi_killmail_detail_queue');
    expect(JSON.parse(body.toString())).toEqual({
      killmailId: 2,
      killmailHash: 'b',
      announce: false,
    });
    expect(options).toEqual({ persistent: true, priority: 5 });
  });

  it('counts the round only after the broker confirmed', async () => {
    await publishPendingRefs(NOW);

    const [sql, now, ids] = prisma.$executeRaw.mock.calls[0];
    expect(sql.join('?')).toMatch(/queued_count = queued_count \+ 1/);
    expect(now).toBe('2026-11-26 10:00:00.000');
    expect(ids).toEqual([2, 1]);
    expect(channel.waitForConfirms.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.$executeRaw.mock.invocationCallOrder[0],
    );
  });

  it('leaves the counters alone when the broker refuses', async () => {
    channel.waitForConfirms.mockRejectedValue(new Error('nack'));

    await expect(publishPendingRefs(NOW)).rejects.toThrow('nack');
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('publishes nothing when nothing is pending', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    expect(await publishPendingRefs(NOW)).toBe(0);
    expect(channel.sendToQueue).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});
