import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A row is the previous UTC day's close, the day is bound as a 'YYYY-MM-DD'
 * string (a JS Date would cross the session time zone), and an empty current
 * map deletes nothing.
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
  snapshotDateFor,
  snapshotSovereignty,
} from './worker-sovereignty-snapshot';

describe('snapshotDateFor', () => {
  it('is the UTC day before now', () => {
    expect(snapshotDateFor(new Date('2026-11-21T01:00:00Z'))).toBe(
      '2026-11-20',
    );
    expect(snapshotDateFor(new Date('2026-11-21T00:00:00Z'))).toBe(
      '2026-11-20',
    );
    expect(snapshotDateFor(new Date('2026-11-01T00:30:00Z'))).toBe(
      '2026-10-31',
    );
  });
});

describe('snapshotSovereignty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn) => fn(tx));
    tx.$executeRaw.mockResolvedValue(0);
  });

  it('skips when the current map is empty', async () => {
    tx.$queryRaw.mockResolvedValue([{ empty: true }]);
    await snapshotSovereignty(new Date('2026-11-21T01:00:00Z'));

    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('writes the day inside one transaction', async () => {
    tx.$queryRaw.mockResolvedValue([{ empty: false }]);
    await snapshotSovereignty(new Date('2026-11-21T01:00:00Z'));

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(4);
    for (const [, ...values] of tx.$executeRaw.mock.calls) {
      expect(values.length).toBeGreaterThan(0);
      expect(values.every((v) => v === '2026-11-20')).toBe(true);
    }
  });
});
