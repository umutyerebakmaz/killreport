import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Writes one character's ESI corporation history. Every fetch stamps every
 * row of the character with the same `fetched_at`, so `MAX(fetched_at)` is
 * when the history was last fetched — the weekly queue script selects on it.
 */

const { prismaMock, txMock } = vi.hoisted(() => {
  const txMock = {
    characterCorporationHistory: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  return {
    txMock,
    prismaMock: {
      corporation: { findMany: vi.fn() },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) =>
        fn(txMock),
      ),
    },
  };
});

vi.mock('@services/prisma-worker', () => ({ default: prismaMock }));

import {
  findMissingCorporationIds,
  saveCorporationHistory,
} from './character-corporation-history-writer';

const fetchedAt = new Date('2026-10-25T12:00:00Z');

beforeEach(() => vi.clearAllMocks());

describe('saveCorporationHistory', () => {
  it('upserts every record keyed on record_id', async () => {
    await saveCorporationHistory(
      42,
      [
        {
          corporation_id: 98148202,
          record_id: 37530077,
          start_date: '2022-09-18T09:56:00Z',
        },
      ],
      fetchedAt,
    );

    const fields = {
      character_id: 42,
      corporation_id: 98148202,
      start_date: new Date('2022-09-18T09:56:00Z'),
      is_deleted: false,
      fetched_at: fetchedAt,
    };
    expect(txMock.characterCorporationHistory.upsert).toHaveBeenCalledWith({
      where: { record_id: BigInt(37530077) },
      create: { record_id: BigInt(37530077), ...fields },
      update: fields,
    });
  });

  it('writes is_deleted as false when ESI leaves it out, true when set', async () => {
    await saveCorporationHistory(
      42,
      [
        { corporation_id: 1, record_id: 2, start_date: '2026-01-01T00:00:00Z' },
        {
          corporation_id: 1024623120,
          record_id: 1,
          start_date: '2007-04-30T17:47:00Z',
          is_deleted: true,
        },
      ],
      fetchedAt,
    );

    const calls = txMock.characterCorporationHistory.upsert.mock.calls;
    expect(calls[0][0].create.is_deleted).toBe(false);
    expect(calls[1][0].create.is_deleted).toBe(true);
  });

  it("stamps fetched_at on all of the character's rows in the same transaction", async () => {
    await saveCorporationHistory(42, [], fetchedAt);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.characterCorporationHistory.updateMany).toHaveBeenCalledWith({
      where: { character_id: 42 },
      data: { fetched_at: fetchedAt },
    });
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
