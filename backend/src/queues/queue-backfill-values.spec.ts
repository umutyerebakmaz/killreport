import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Pages are cut by `killmail_id`, below the largest ID the run saw at its
 * start, so killmails saved meanwhile neither shift the pages nor push older
 * ones out; capsules are picked by group 29, and each page waits for
 * publisher confirms.
 */

const { prisma, publishEntitiesConfirmed, logger } = vi.hoisted(() => ({
  prisma: {
    killmail: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    type: { findMany: vi.fn() },
    $disconnect: vi.fn(),
  },
  publishEntitiesConfirmed: vi.fn(async (_q, _s, ids: number[]) => ids.length),
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@services/prisma-worker', () => ({ default: prisma }));
vi.mock('@services/logger', () => ({ default: logger }));
vi.mock('@services/rabbitmq', () => ({ ensureAllQueuesExist: vi.fn() }));
vi.mock('./publish-entities', () => ({ publishEntitiesConfirmed }));

import {
  backfillWhere,
  parseArgs,
  queueBackfillValues,
} from './queue-backfill-values';

const ids = (from: number, to: number) =>
  Array.from({ length: from - to + 1 }, (_, i) => ({ killmail_id: from - i }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseArgs', () => {
  it('reads the three flags', () => {
    expect(parseArgs([])).toEqual({ capsulesOnly: false });
    expect(
      parseArgs(['--limit=10000', '--capsules-only', '--id=133900250']),
    ).toEqual({ limit: 10000, id: 133900250, capsulesOnly: true });
  });

  it('refuses a bad value or an unknown flag', () => {
    for (const bad of [
      '--limit=abc',
      '--limit=0',
      '--id=',
      '--mode=all',
      'extra',
    ]) {
      expect(() => parseArgs([bad]), bad).toThrow();
    }
  });
});

describe('backfillWhere', () => {
  it('picks capsules by group, not by type 670', async () => {
    prisma.type.findMany.mockResolvedValue([{ id: 670 }, { id: 33328 }]);

    expect(await backfillWhere({ capsulesOnly: true })).toEqual({
      victim: { ship_type_id: { in: [670, 33328] } },
    });
    expect(prisma.type.findMany).toHaveBeenCalledWith({
      where: { group_id: { in: [29] } },
      select: { id: true },
    });
  });

  it('is one killmail with --id, everything without flags', async () => {
    expect(await backfillWhere({ id: 7, capsulesOnly: false })).toEqual({
      killmail_id: 7,
    });
    expect(await backfillWhere({ capsulesOnly: false })).toEqual({});
  });
});

describe('queueBackfillValues', () => {
  it('pages by killmail_id below the starting maximum', async () => {
    prisma.killmail.count.mockResolvedValue(700);
    prisma.killmail.aggregate.mockResolvedValue({
      _max: { killmail_id: 1000 },
    });
    prisma.killmail.findMany
      .mockResolvedValueOnce(ids(1000, 501))
      .mockResolvedValueOnce(ids(500, 301));

    expect(await queueBackfillValues({ capsulesOnly: false })).toBe(700);

    const [first, second] = prisma.killmail.findMany.mock.calls.map(
      (c) => c[0],
    );
    expect(first).toEqual({
      where: { AND: [{}, { killmail_id: { lt: 1001 } }] },
      select: { killmail_id: true },
      orderBy: { killmail_id: 'desc' },
      take: 500,
    });
    expect(second.where).toEqual({
      AND: [{}, { killmail_id: { lt: 501 } }],
    });
    expect(second.take).toBe(200);
    expect(first).not.toHaveProperty('skip');
    expect(publishEntitiesConfirmed).toHaveBeenCalledWith(
      'backfill_killmail_values_queue',
      'queue-backfill-values',
      ids(1000, 501).map((k) => k.killmail_id),
      { idField: 'killmailId' },
    );
  });

  it('respects --limit and stops on an empty page', async () => {
    prisma.killmail.count.mockResolvedValue(5000);
    prisma.killmail.aggregate.mockResolvedValue({
      _max: { killmail_id: 5000 },
    });
    prisma.killmail.findMany
      .mockResolvedValueOnce(ids(5000, 4991))
      .mockResolvedValueOnce([]);

    expect(await queueBackfillValues({ limit: 10, capsulesOnly: false })).toBe(
      10,
    );
    expect(prisma.killmail.findMany.mock.calls[0][0].take).toBe(10);
    expect(prisma.killmail.findMany).toHaveBeenCalledTimes(1);
  });

  it('queues nothing when nothing matches', async () => {
    prisma.killmail.count.mockResolvedValue(0);
    prisma.killmail.aggregate.mockResolvedValue({
      _max: { killmail_id: null },
    });

    expect(await queueBackfillValues({ capsulesOnly: false })).toBe(0);
    expect(prisma.killmail.findMany).not.toHaveBeenCalled();
    expect(publishEntitiesConfirmed).not.toHaveBeenCalled();
  });
});
