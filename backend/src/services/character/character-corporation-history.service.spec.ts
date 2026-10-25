import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ESI gives each record a start date only. A record ends where the next,
 * newer one starts; the newest one is the character's current corporation
 * and has no end.
 */

const { prisma, redis } = vi.hoisted(() => ({
  prisma: { characterCorporationHistory: { findMany: vi.fn() } },
  redis: { get: vi.fn(), setex: vi.fn() },
}));

vi.mock('@services/prisma', () => ({ default: prisma }));
vi.mock('@services/redis', () => ({ default: redis, redis }));

import { getCorporationHistory } from './character-corporation-history.service';

const row = (record_id: number, corporation_id: number, start: string) => ({
  record_id: BigInt(record_id),
  character_id: 42,
  corporation_id,
  start_date: new Date(start),
  is_deleted: false,
  fetched_at: new Date('2026-10-25T00:00:00Z'),
});

beforeEach(() => {
  vi.clearAllMocks();
  redis.get.mockResolvedValue(null);
});

describe('getCorporationHistory', () => {
  it('returns the cached value without querying', async () => {
    redis.get.mockResolvedValue(JSON.stringify([{ recordId: 1 }]));

    await expect(getCorporationHistory(42)).resolves.toEqual([{ recordId: 1 }]);
    expect(redis.get).toHaveBeenCalledWith('character:corporation-history:42');
    expect(prisma.characterCorporationHistory.findMany).not.toHaveBeenCalled();
  });

  it('queries newest first, record_id breaking ties, and caches for 7200 s', async () => {
    prisma.characterCorporationHistory.findMany.mockResolvedValue([
      row(1, 10, '2019-01-01T00:00:00Z'),
    ]);

    const history = await getCorporationHistory(42);

    expect(prisma.characterCorporationHistory.findMany).toHaveBeenCalledWith({
      where: { character_id: 42 },
      orderBy: [{ start_date: 'desc' }, { record_id: 'desc' }],
    });
    expect(redis.setex).toHaveBeenCalledWith(
      'character:corporation-history:42',
      7200,
      JSON.stringify(history),
    );
  });

  it('ends each record where the next, newer one starts; the newest has no end', async () => {
    prisma.characterCorporationHistory.findMany.mockResolvedValue([
      row(66722751, 98221968, '2026-06-05T14:57:00Z'),
      row(37530077, 109299958, '2015-03-24T11:44:00Z'),
      row(37530055, 1000171, '2015-03-24T11:37:00Z'),
    ]);

    const history = await getCorporationHistory(42);

    expect(history).toEqual([
      {
        recordId: 66722751,
        corporationId: 98221968,
        startDate: '2026-06-05T14:57:00.000Z',
        endDate: null,
        isDeleted: false,
      },
      {
        recordId: 37530077,
        corporationId: 109299958,
        startDate: '2015-03-24T11:44:00.000Z',
        endDate: '2026-06-05T14:57:00.000Z',
        isDeleted: false,
      },
      {
        recordId: 37530055,
        corporationId: 1000171,
        startDate: '2015-03-24T11:37:00.000Z',
        endDate: '2015-03-24T11:44:00.000Z',
        isDeleted: false,
      },
    ]);
    expect(typeof history[0].recordId).toBe('number');
  });

  it('chains end dates by row order when two records share a start date', async () => {
    prisma.characterCorporationHistory.findMany.mockResolvedValue([
      row(3, 30, '2020-01-01T00:00:00Z'),
      row(2, 20, '2020-01-01T00:00:00Z'),
      row(1, 10, '2019-01-01T00:00:00Z'),
    ]);

    const history = await getCorporationHistory(42);

    expect(history.map((h) => [h.recordId, h.endDate])).toEqual([
      [3, null],
      [2, '2020-01-01T00:00:00.000Z'],
      [1, '2020-01-01T00:00:00.000Z'],
    ]);
  });

  it('returns an empty list for a character never fetched, without caching it', async () => {
    prisma.characterCorporationHistory.findMany.mockResolvedValue([]);

    await expect(getCorporationHistory(42)).resolves.toEqual([]);
    // Cached, the empty list would outlive the worker's first fetch by up to 7200 s
    expect(redis.setex).not.toHaveBeenCalled();
  });
});
