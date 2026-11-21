import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `now` is bound as a UTC 'YYYY-MM-DD HH:MM:SS.mmm' string (a JS Date would
 * cross the session time zone on the way to a `timestamp` column), and the
 * count, tag and roll-up run in one transaction.
 */

const { prisma, tx, logger } = vi.hoisted(() => {
  const tx = { $queryRaw: vi.fn(), $executeRaw: vi.fn() };
  return {
    tx,
    prisma: { $transaction: vi.fn(), $disconnect: vi.fn() },
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

vi.mock('@services/prisma-worker', () => ({ default: prisma }));
vi.mock('@services/logger', () => ({ default: logger }));

import {
  correlateSovereigntyKillmails,
  timestampFor,
} from './worker-sovereignty-correlate';

describe('timestampFor', () => {
  it('is the UTC wall clock without a zone', () => {
    expect(timestampFor(new Date('2026-11-22T12:00:00.123Z'))).toBe(
      '2026-11-22 12:00:00.123',
    );
    expect(timestampFor(new Date('2026-11-22T00:00:00.000Z'))).toBe(
      '2026-11-22 00:00:00.000',
    );
  });
});

describe('correlateSovereigntyKillmails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn) => fn(tx));
  });

  it('runs the three statements in one transaction', async () => {
    tx.$queryRaw.mockResolvedValue([{ n: 3 }]);
    tx.$executeRaw.mockResolvedValueOnce(5).mockResolvedValueOnce(2);

    await correlateSovereigntyKillmails(new Date('2026-11-22T12:00:00.000Z'));

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    const calls = [...tx.$queryRaw.mock.calls, ...tx.$executeRaw.mock.calls];
    for (const [, ...values] of calls) {
      expect(values.length).toBeGreaterThan(0);
      expect(values.every((v) => v === '2026-11-22 12:00:00.000')).toBe(true);
    }
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        '5 new killmails tagged, 2/3 campaigns have war kills',
      ),
    );
  });
});
