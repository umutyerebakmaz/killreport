import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The leaderboard resolvers are thin: cache read, one raw query, a batched
 * entity lookup, cache write. What is worth pinning down is the SQL they emit
 * and the cache key they emit it under — a missing filter parameter in the key
 * lets one query serve another's rows.
 */

const { prisma, redis } = vi.hoisted(() => ({
  prisma: {
    $queryRaw: vi.fn(),
    character: { findMany: vi.fn() },
    corporation: { findMany: vi.fn() },
    alliance: { findMany: vi.fn() },
    type: { findMany: vi.fn() },
    solarSystem: { findMany: vi.fn() },
    region: { findMany: vi.fn() },
    faction: { findMany: vi.fn() },
  },
  redis: { get: vi.fn(), setex: vi.fn() },
}));

vi.mock('@services/prisma', () => ({ default: prisma }));
vi.mock('@services/redis', () => ({ default: redis, redis }));

import { LeaderboardPeriod } from '@generated-types';

import { leaderboardQueries } from './queries';
import { resolvePeriod } from './period';

/** The SQL text of the nth $queryRaw call, values replaced by "?". */
function querySql(call = 0) {
  const [strings] = prisma.$queryRaw.mock.calls[call] as [TemplateStringsArray];
  return strings.join(' ? ').replace(/\s+/g, ' ');
}

/**
 * The values bound to the nth $queryRaw call's placeholders. A conditional
 * clause built with `Prisma.sql` (unmocked here, so it is the real tag
 * function) shows up as a nested Sql object rather than its raw value —
 * flatten one level so a test can assert on the value that actually reaches
 * Postgres.
 */
function queryValues(call = 0) {
  const [, ...values] = prisma.$queryRaw.mock.calls[call] as [
    TemplateStringsArray,
    ...unknown[],
  ];
  return values.flatMap((v) =>
    v &&
    typeof v === 'object' &&
    Array.isArray((v as { values?: unknown }).values)
      ? (v as { values: unknown[] }).values
      : [v],
  );
}

/** Calls a resolver with the parent/context/info arguments it ignores. */
function call(name: keyof typeof leaderboardQueries, filter: unknown) {
  const resolver = leaderboardQueries[name] as unknown as (
    parent: unknown,
    args: unknown,
    context: unknown,
    info: unknown,
  ) => Promise<unknown>;
  return resolver(undefined, { filter }, {}, {});
}

/** A character row as Prisma returns it. */
function characterRow(id: number) {
  return {
    id,
    name: `Pilot ${id}`,
    security_status: 1.5,
    birthday: new Date('2020-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-09-01T00:00:00.000Z'),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  redis.get.mockResolvedValue(null);
  redis.setex.mockResolvedValue('OK');
  prisma.$queryRaw.mockResolvedValue([]);
  prisma.character.findMany.mockResolvedValue([]);
  prisma.corporation.findMany.mockResolvedValue([]);
  prisma.alliance.findMany.mockResolvedValue([]);
  prisma.type.findMany.mockResolvedValue([]);
  prisma.solarSystem.findMany.mockResolvedValue([]);
  prisma.region.findMany.mockResolvedValue([]);
  prisma.faction.findMany.mockResolvedValue([]);
});

describe('topPilots', () => {
  it('serves a cache hit without touching the database', async () => {
    const cached = [{ rank: 1, killCount: 9, character: null }];
    redis.get.mockResolvedValue(JSON.stringify(cached));

    await expect(call('topPilots', { limit: 10 })).resolves.toEqual(cached);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('defaults to the last 7 days and reads the daily stats table', async () => {
    await call('topPilots', { limit: 10 });

    expect(querySql()).toContain('FROM character_kill_stats');
    expect(querySql()).toContain('SUM(kill_count)');
  });

  it('puts every filter parameter in the cache key', async () => {
    await call('topPilots', {
      period: LeaderboardPeriod.Week,
      anchor: '2026-09-03',
      limit: 25,
      systemId: 30000142,
      constellationId: 20000020,
      regionId: 10000002,
    });

    const [key] = redis.get.mock.calls[0];
    expect(key).toBe(
      'leaderboard:topPilots:WEEK:2026-08-31:25:30000142:20000020:10000002',
    );
  });

  it('switches to the killmail_filters join when a system is given', async () => {
    await call('topPilots', { limit: 10, systemId: 30000142 });

    expect(querySql()).toContain('FROM attackers a');
    expect(querySql()).toContain('INNER JOIN killmail_filters kf');
    expect(querySql()).toContain('COUNT(DISTINCT kf.killmail_id)');
    expect(queryValues()).toContain(30000142);
  });

  it('bounds the upper edge with < next day, not <=', async () => {
    await call('topPilots', { limit: 10, systemId: 30000142 });

    expect(querySql()).toContain("< ? ::date + INTERVAL '1 day'");
    expect(querySql()).not.toContain("<= ? ::date + INTERVAL '1 day'");
  });

  it('caps the limit at 100', async () => {
    await call('topPilots', { limit: 5000 });

    expect(queryValues()).toContain(100);
  });

  it('converts BigInt counts before caching', async () => {
    prisma.$queryRaw.mockResolvedValue([{ character_id: 42, kill_count: 7n }]);
    prisma.character.findMany.mockResolvedValue([characterRow(42)]);

    const result = (await call('topPilots', { limit: 10 })) as Array<{
      killCount: number;
    }>;

    expect(result[0].killCount).toBe(7);
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('caches a live window for 300 s and a closed one for 3600 s', async () => {
    // setex is only reached when there are rows to cache.
    prisma.$queryRaw.mockResolvedValue([{ character_id: 42, kill_count: 7n }]);
    prisma.character.findMany.mockResolvedValue([characterRow(42)]);

    await call('topPilots', { period: LeaderboardPeriod.Today, limit: 10 });
    expect(redis.setex.mock.calls[0][1]).toBe(300);

    await call('topPilots', {
      period: LeaderboardPeriod.Today,
      anchor: '2020-01-01',
      limit: 10,
    });
    expect(redis.setex.mock.calls[1][1]).toBe(3600);
  });

  it('returns an empty list without a lookup when there are no rows', async () => {
    await expect(call('topPilots', { limit: 10 })).resolves.toEqual([]);
    expect(prisma.character.findMany).not.toHaveBeenCalled();
  });
});

describe('topCorporations', () => {
  it('reads the corporation stats table by default', async () => {
    await call('topCorporations', { limit: 10 });

    expect(querySql()).toContain('FROM corporation_kill_stats');
  });

  it('puts every filter parameter in the cache key', async () => {
    await call('topCorporations', {
      period: LeaderboardPeriod.Month,
      anchor: '2026-07',
      limit: 25,
      regionId: 10000002,
    });

    const [key] = redis.get.mock.calls[0];
    expect(key).toBe('leaderboard:topCorporations:MONTH:2026-07:25:::10000002');
  });

  it('joins killmail_filters when a region is given', async () => {
    await call('topCorporations', { limit: 10, regionId: 10000002 });

    expect(querySql()).toContain('INNER JOIN killmail_filters kf');
    expect(querySql()).toContain('COUNT(DISTINCT kf.killmail_id)');
    expect(queryValues()).toContain(10000002);
  });

  it('converts BigInt counts before caching', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { corporation_id: 98000001, kill_count: 4n },
    ]);
    prisma.corporation.findMany.mockResolvedValue([
      { id: 98000001, name: 'Corp', shares: null, updated_at: null },
    ]);

    const result = (await call('topCorporations', { limit: 10 })) as Array<{
      killCount: number;
    }>;

    expect(result[0].killCount).toBe(4);
  });
});

describe('topAlliances', () => {
  it('reads the alliance stats table by default', async () => {
    await call('topAlliances', { limit: 10 });

    expect(querySql()).toContain('FROM alliance_kill_stats');
  });

  it('puts every filter parameter in the cache key', async () => {
    await call('topAlliances', { limit: 10, systemId: 30000142 });

    const [key] = redis.get.mock.calls[0];
    expect(key).toMatch(
      /^leaderboard:topAlliances:LAST_7_DAYS:\d{4}-\d{2}-\d{2}:10:30000142::$/,
    );
  });

  it('joins killmail_filters when a system is given', async () => {
    await call('topAlliances', { limit: 10, systemId: 30000142 });

    expect(querySql()).toContain('INNER JOIN killmail_filters kf');
  });
});

describe('topDestroyedShips', () => {
  it('counts victim ships straight out of killmail_filters', async () => {
    await call('topDestroyedShips', { limit: 10 });

    expect(querySql()).toContain('FROM killmail_filters');
    expect(querySql()).toContain('victim_ship_type_id');
    expect(querySql()).not.toContain('FROM attackers');
  });

  it('bounds the upper edge with < next day', async () => {
    await call('topDestroyedShips', { limit: 10 });

    expect(querySql()).toContain("< ? ::date + INTERVAL '1 day'");
  });

  it('puts every filter parameter in the cache key', async () => {
    await call('topDestroyedShips', { limit: 10, constellationId: 20000020 });

    const [key] = redis.get.mock.calls[0];
    expect(key).toMatch(
      /^leaderboard:topDestroyedShips:LAST_7_DAYS:\d{4}-\d{2}-\d{2}:10::20000020:$/,
    );
  });

  it('converts BigInt counts before caching', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { victim_ship_type_id: 670, kill_count: 650n },
    ]);
    prisma.type.findMany.mockResolvedValue([{ id: 670, name: 'Capsule' }]);

    const result = (await call('topDestroyedShips', { limit: 10 })) as Array<{
      killCount: number;
    }>;

    expect(result[0].killCount).toBe(650);
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});

describe('topAttackerShips', () => {
  it('joins killmail_filters rather than killmails', async () => {
    await call('topAttackerShips', { limit: 10 });

    expect(querySql()).toContain('INNER JOIN killmail_filters kf');
    expect(querySql()).not.toContain('INNER JOIN killmails');
  });

  it('counts every attacker row, not distinct killmails', async () => {
    await call('topAttackerShips', { limit: 10 });

    expect(querySql()).toContain('COUNT(*)');
    expect(querySql()).not.toContain('COUNT(DISTINCT');
  });

  it('joins killmail_filters and passes the spatial filter as a value', async () => {
    await call('topAttackerShips', { limit: 10, systemId: 30000142 });

    expect(querySql()).toContain('INNER JOIN killmail_filters kf');
    expect(queryValues()).toContain(30000142);
  });

  it('puts the spatial parameters in the cache key', async () => {
    await call('topAttackerShips', { limit: 10, systemId: 30000142 });

    const [key] = redis.get.mock.calls[0];
    expect(key).toMatch(
      /^leaderboard:topAttackerShips:LAST_7_DAYS:\d{4}-\d{2}-\d{2}:10:30000142::$/,
    );
  });

  it('converts BigInt counts before caching', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { ship_type_id: 638, kill_count: 479n },
    ]);
    prisma.type.findMany.mockResolvedValue([{ id: 638, name: 'Raven' }]);

    const result = (await call('topAttackerShips', { limit: 10 })) as Array<{
      killCount: number;
    }>;

    expect(result[0].killCount).toBe(479);
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});

describe('topSystems', () => {
  it('counts killmails per system straight out of killmail_filters', async () => {
    await call('topSystems', { limit: 10 });

    expect(querySql()).toContain('FROM killmail_filters');
    expect(querySql()).toContain('GROUP BY solar_system_id');
    expect(querySql()).not.toContain('FROM attackers');
  });

  it('bounds the upper edge with < next day', async () => {
    await call('topSystems', { limit: 10 });

    expect(querySql()).toContain("< ? ::date + INTERVAL '1 day'");
  });

  it('puts every filter parameter in the cache key', async () => {
    await call('topSystems', { limit: 10, regionId: 10000002 });

    const [key] = redis.get.mock.calls[0];
    expect(key).toMatch(
      /^leaderboard:topSystems:LAST_7_DAYS:\d{4}-\d{2}-\d{2}:10:::10000002$/,
    );
  });

  it('converts BigInt counts before caching', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { solar_system_id: 30000142, kill_count: 91n },
    ]);
    prisma.solarSystem.findMany.mockResolvedValue([
      { id: 30000142, name: 'Jita' },
    ]);

    const result = (await call('topSystems', { limit: 10 })) as Array<{
      killCount: number;
    }>;

    expect(result[0].killCount).toBe(91);
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});

describe('topRegions', () => {
  it('groups by region rather than system', async () => {
    await call('topRegions', { limit: 10 });

    expect(querySql()).toContain('FROM killmail_filters');
    expect(querySql()).toContain('GROUP BY region_id');
  });

  it('puts every filter parameter in the cache key', async () => {
    await call('topRegions', { limit: 10 });

    const [key] = redis.get.mock.calls[0];
    expect(key).toMatch(
      /^leaderboard:topRegions:LAST_7_DAYS:\d{4}-\d{2}-\d{2}:10:::$/,
    );
  });

  it('converts BigInt counts before caching', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { region_id: 10000002, kill_count: 337n },
    ]);
    prisma.region.findMany.mockResolvedValue([
      { id: 10000002, name: 'The Forge' },
    ]);

    const result = (await call('topRegions', { limit: 10 })) as Array<{
      killCount: number;
    }>;

    expect(result[0].killCount).toBe(337);
  });
});

describe('topFactions', () => {
  it('joins attackers to killmail_filters and counts distinct killmails', async () => {
    await call('topFactions', { limit: 10 });

    expect(querySql()).toContain('FROM attackers a');
    expect(querySql()).toContain('INNER JOIN killmail_filters kf');
    expect(querySql()).toContain('COUNT(DISTINCT kf.killmail_id)');
    expect(querySql()).toContain('GROUP BY a.faction_id');
  });

  it('excludes the 500021 placeholder', async () => {
    await call('topFactions', { limit: 10 });

    expect(queryValues()).toContain(500021);
    expect(querySql()).toContain('a.faction_id <> ?');
  });

  it('accepts a spatial filter and passes it to the query', async () => {
    await call('topFactions', { limit: 10, systemId: 30000142 });

    expect(querySql()).toContain('INNER JOIN killmail_filters kf');
    expect(queryValues()).toContain(30000142);
  });

  it('puts every filter parameter in the cache key', async () => {
    await call('topFactions', { limit: 10, systemId: 30000142 });

    const [key] = redis.get.mock.calls[0];
    expect(key).toMatch(
      /^leaderboard:topFactions:LAST_7_DAYS:\d{4}-\d{2}-\d{2}:10:30000142::$/,
    );
  });

  it('converts BigInt counts before caching', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { faction_id: 500003, kill_count: 25n },
    ]);
    prisma.faction.findMany.mockResolvedValue([
      {
        id: 500003,
        name: 'Amarr Empire',
        description: null,
        corporation_id: 1000084,
        militia_corporation_id: 1000179,
      },
    ]);

    const result = (await call('topFactions', { limit: 10 })) as Array<{
      killCount: number;
      faction: { corporationId: number | null } | null;
    }>;

    expect(result[0].killCount).toBe(25);
    expect(result[0].faction?.corporationId).toBe(1000084);
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});

describe('every subject accepts every period', () => {
  const SUBJECTS = [
    'topPilots',
    'topCorporations',
    'topAlliances',
    'topDestroyedShips',
    'topAttackerShips',
    'topFactions',
    'topSystems',
    'topRegions',
  ] as const;

  const PERIODS = [
    [LeaderboardPeriod.Today, null],
    [LeaderboardPeriod.Week, null],
    [LeaderboardPeriod.Month, null],
    [LeaderboardPeriod.Last_7Days, null],
    [LeaderboardPeriod.Last_90Days, null],
  ] as const;

  // A fixed clock so `resolvePeriod` inside the test and inside the resolver
  // agree on what "today" is — otherwise a run straddling midnight could
  // make the two disagree without either being wrong.
  const NOW = new Date('2026-09-09T11:30:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  for (const subject of SUBJECTS) {
    for (const [period] of PERIODS) {
      it(`${subject} over ${period}`, async () => {
        await expect(call(subject, { period, limit: 10 })).resolves.toEqual([]);

        // The window reached the query rather than being silently dropped.
        expect(prisma.$queryRaw).toHaveBeenCalledOnce();
        const [key] = redis.get.mock.calls[0];
        expect(key).toContain(`:${period}:`);

        // Not just the cache key — the actual startDate resolvePeriod
        // produced must be one of the values bound into the SQL. A resolver
        // that keyed the cache correctly but bound `cacheAnchor` (or a bare
        // `today`) instead would pass the assertions above while silently
        // serving the wrong window.
        const { startDate } = resolvePeriod(period, null, NOW);
        expect(queryValues()).toContain(startDate);
      });
    }
  }
});
