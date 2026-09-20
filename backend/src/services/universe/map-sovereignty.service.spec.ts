import { beforeEach, describe, expect, it, vi } from 'vitest';

// Vitest hoists vi.mock above plain consts, so the factory's outer variables
// come from vi.hoisted — the same pattern map-labels.service.spec.ts uses.
const { redis, prisma } = vi.hoisted(() => ({
  redis: { get: vi.fn(), setex: vi.fn() },
  prisma: { $queryRaw: vi.fn() },
}));
vi.mock('@services/redis', () => ({ default: redis, redis }));
vi.mock('@services/prisma', () => ({ default: prisma, prisma }));

import { Prisma } from '@generated/prisma/client';
import {
  getMapSovereignty,
  sovCacheKey,
  SOV_CACHE_TTL_SECONDS,
} from './map-sovereignty.service';

function queryText(call: number): string {
  return (prisma.$queryRaw.mock.calls[call][0] as Prisma.Sql).sql;
}

beforeEach(() => {
  redis.get.mockReset();
  redis.setex.mockReset();
  prisma.$queryRaw.mockReset();
  redis.get.mockResolvedValue(null);
});

describe('sovCacheKey', () => {
  it('carries the scope, so one scene never serves another', () => {
    expect(sovCacheKey('NEW_EDEN')).toBe('map:sov:NEW_EDEN');
    expect(sovCacheKey('POCHVEN')).toBe('map:sov:POCHVEN');
    expect(sovCacheKey('NEW_EDEN')).not.toBe(sovCacheKey('WORMHOLE'));
  });
});

describe('getMapSovereignty', () => {
  it('returns the cached value without touching the database', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({
        scope: 'NEW_EDEN',
        owners: [],
        systems: [],
        updatedAt: null,
      }),
    );

    const sov = await getMapSovereignty('NEW_EDEN');

    expect(sov.systems).toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('runs both queries through the scene predicate', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await getMapSovereignty('NEW_EDEN');

    // The gateless filter matters as much as the band: a sovereignty row for
    // a Jove system would put an owner on the map that the geometry never
    // draws, and its colour would be in the legend with nothing under it.
    for (const call of [0, 1]) {
      expect(queryText(call)).toContain('c.region_id BETWEEN');
      expect(queryText(call)).toContain('FROM stargates g');
    }
  });

  it('converts the BIGINT count to a number before caching it', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ system_id: 30000142, owner_id: 99003581 }])
      .mockResolvedValueOnce([
        {
          owner_id: 99003581,
          kind: 'ALLIANCE',
          name: 'Brave Collective',
          ticker: 'BRAVE',
          // What $queryRaw actually hands back for ::BIGINT. JSON.stringify
          // throws on it, so a service that forgot the Number() would fail
          // right here rather than in production.
          system_count: 329n,
          updated_at: new Date('2026-09-12T14:33:56.686Z'),
        },
      ]);

    const sov = await getMapSovereignty('NEW_EDEN');

    expect(sov.owners[0].systemCount).toBe(329);
    expect(typeof sov.owners[0].systemCount).toBe('number');
    expect(sov.updatedAt).toBe('2026-09-12T14:33:56.686Z');
    expect(redis.setex).toHaveBeenCalledWith(
      'map:sov:NEW_EDEN',
      SOV_CACHE_TTL_SECONDS,
      expect.any(String),
    );
  });

  it('names an owner the entity tables do not know by its id', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        owner_id: 99015215,
        kind: 'ALLIANCE',
        name: null,
        ticker: null,
        system_count: 2n,
        updated_at: null,
      },
    ]);

    // An alliance that took sov before the info worker fetched it still has to
    // appear: the legend row is the only place the map admits it exists.
    const sov = await getMapSovereignty('NEW_EDEN');

    expect(sov.owners[0].name).toBe('#99015215');
  });
});
