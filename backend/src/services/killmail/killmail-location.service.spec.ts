import { beforeEach, describe, expect, it, vi } from 'vitest';

// Entries are written through a pipeline — one round trip for a whole
// DataLoader batch — so the mock hands back a pipeline object and the
// assertions count calls on ITS setex.
const { prisma, redis, pipelineSetex } = vi.hoisted(() => {
  const pipelineSetex = vi.fn();
  return {
    pipelineSetex,
    prisma: { $queryRaw: vi.fn() },
    redis: {
      mget: vi.fn(),
      pipeline: vi.fn(() => ({
        setex: pipelineSetex,
        exec: vi.fn().mockResolvedValue([]),
      })),
    },
  };
});

vi.mock('@services/prisma', () => ({ default: prisma }));
vi.mock('@services/redis', () => ({ default: redis, redis }));

import {
  getKillmailLocations,
  LOCATION_CACHE_TTL_SECONDS,
  locationCacheKey,
} from './killmail-location.service';

const gate = {
  killmail_id: 101,
  kind: 'GATE',
  id: 50001,
  name: 'Stargate (O-VWPB)',
  distance: 83000,
};

function querySql() {
  const [strings] = prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray];
  return strings.join(' ? ').replace(/\s+/g, ' ');
}

beforeEach(() => {
  vi.clearAllMocks();
  redis.mget.mockImplementation(async (...keys: string[]) =>
    keys.map(() => null),
  );
  prisma.$queryRaw.mockResolvedValue([]);
});

describe('getKillmailLocations', () => {
  it('returns nothing for no ids, without touching Redis or the database', async () => {
    await expect(getKillmailLocations([])).resolves.toEqual([]);
    expect(redis.mget).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('serves cached entries, a cached null included, without a query', async () => {
    const cached = { kind: 'MOON', id: 7, name: 'Moon 1', distance: 12 };
    redis.mget.mockResolvedValue([JSON.stringify(cached), 'null']);

    await expect(getKillmailLocations([1, 2])).resolves.toEqual([cached, null]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('queries the misses once and caches every one of them, nulls too', async () => {
    prisma.$queryRaw.mockResolvedValue([gate]);

    const result = await getKillmailLocations([101, 102]);

    expect(result).toEqual([
      { kind: 'GATE', id: 50001, name: 'Stargate (O-VWPB)', distance: 83000 },
      null,
    ]);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(pipelineSetex).toHaveBeenCalledWith(
      locationCacheKey(101),
      LOCATION_CACHE_TTL_SECONDS,
      JSON.stringify(result[0]),
    );
    expect(pipelineSetex).toHaveBeenCalledWith(
      locationCacheKey(102),
      LOCATION_CACHE_TTL_SECONDS,
      'null',
    );
  });

  it('answers in the order asked, repeats included', async () => {
    prisma.$queryRaw.mockResolvedValue([gate]);

    const result = await getKillmailLocations([102, 101, 101]);

    expect(result.map((l) => l?.id ?? null)).toEqual([null, 50001, 50001]);
  });

  it('measures in three dimensions, from the star at the system centre', async () => {
    await getKillmailLocations([101]);

    const sql = querySql();
    expect(sql).toMatch(/position_y/);
    expect(sql).toMatch(/'STAR'[\s\S]*0::DOUBLE PRECISION AS x/);
    for (const kind of ['PLANET', 'MOON', 'BELT', 'STATION', 'GATE']) {
      expect(sql).toContain(`'${kind}'`);
    }
    expect(sql).toMatch(/ORDER BY distance LIMIT 1/);
  });
});
