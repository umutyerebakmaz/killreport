import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Writes one character's ESI corporation history. Every fetch stamps every
 * row of the character with the same `fetched_at`, so `MAX(fetched_at)` is
 * when the history was last fetched — the weekly queue script selects on it.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    corporation: { findMany: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

vi.mock('@services/prisma-worker', () => ({ default: prismaMock }));

import {
  findMissingCorporationIds,
  saveCorporationHistory,
} from './character-corporation-history-writer';

const fetchedAt = new Date('2026-10-25T12:00:00Z');

beforeEach(() => vi.clearAllMocks());

/** The values bound into the one `$executeRaw` tagged-template call. */
const boundValues = () => prismaMock.$executeRaw.mock.calls[0].slice(1);

describe('saveCorporationHistory', () => {
  it('writes the whole history in one statement, outside a transaction', async () => {
    await saveCorporationHistory(
      42,
      [
        {
          corporation_id: 98148202,
          record_id: 37530077,
          start_date: '2022-09-18T09:56:00Z',
        },
        {
          corporation_id: 1024623120,
          record_id: 1,
          start_date: '2007-04-30T17:47:00Z',
          is_deleted: true,
        },
      ],
      fetchedAt,
    );

    // A transaction holds one of the worker pool's two connections for the
    // whole loop, and a full prefetch of them times out waiting (P2028)
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
    expect(boundValues()).toEqual(
      expect.arrayContaining([
        [37530077, 1],
        [98148202, 1024623120],
        ['2022-09-18T09:56:00Z', '2007-04-30T17:47:00Z'],
        [false, true],
        42,
        '2026-10-25T12:00:00.000Z',
      ]),
    );
  });

  it("still stamps fetched_at on the character's rows when ESI returns none", async () => {
    await saveCorporationHistory(42, [], fetchedAt);

    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
    expect(boundValues()).toEqual(
      expect.arrayContaining([[], 42, '2026-10-25T12:00:00.000Z']),
    );
  });
});

describe('findMissingCorporationIds', () => {
  it('returns the distinct ids that have no corporations row', async () => {
    prismaMock.corporation.findMany.mockResolvedValue([{ id: 2 }]);

    await expect(findMissingCorporationIds([1, 2, 2, 3])).resolves.toEqual([
      1, 3,
    ]);
    expect(prismaMock.corporation.findMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2, 3] } },
      select: { id: true },
    });
  });

  it('does not query for an empty list', async () => {
    await expect(findMissingCorporationIds([])).resolves.toEqual([]);
    expect(prismaMock.corporation.findMany).not.toHaveBeenCalled();
  });
});
