import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The faction read service: Redis get, then the database, then Redis setex,
 * with every filter parameter in the key. What is pinned here is what would
 * return a wrong number rather than throw: a key that loses the filter, a
 * BigInt that reaches JSON.stringify, a member count that disagrees with the
 * Members tab, and a target list that includes the faction itself.
 */

const { prisma, redis } = vi.hoisted(() => ({
  prisma: {
    $queryRaw: vi.fn(),
    corporation: { count: vi.fn() },
    character: { count: vi.fn() },
    sovereigntyMapCurrent: { count: vi.fn() },
  },
  redis: { get: vi.fn(), setex: vi.fn() },
}));

vi.mock('@services/prisma', () => ({ default: prisma }));
vi.mock('@services/redis', () => ({ default: redis, redis }));

import * as FactionStats from './faction-stats.service';

const AMARR = 500003;

function querySql(call = 0) {
  const [strings] = prisma.$queryRaw.mock.calls[call] as [TemplateStringsArray];
  return strings.join(' ? ').replace(/\s+/g, ' ');
}

/** Bound values, flattened through nested Prisma.sql fragments. */
function queryValues(call = 0): unknown[] {
  const [, ...values] = prisma.$queryRaw.mock.calls[call] as [
    TemplateStringsArray,
    ...unknown[],
  ];
  return values.flatMap((v) =>
    v && typeof v === 'object' && 'values' in v
      ? (v as { values: unknown[] }).values
      : [v],
  );
}

beforeEach(() => {
  redis.get.mockResolvedValue(null);
  redis.setex.mockResolvedValue('OK');
  prisma.$queryRaw.mockResolvedValue([]);
  prisma.corporation.count.mockResolvedValue(0);
  prisma.character.count.mockResolvedValue(0);
  prisma.sovereigntyMapCurrent.count.mockResolvedValue(0);
});

const TOP_QUERIES = [
  ['getFactionTopCharacters', 'characters'],
  ['getFactionTopCorporations', 'corporations'],
  ['getFactionTopShips', 'top_ships'],
  ['getFactionTopFactionTargets', 'factions'],
  ['getFactionTopShipTargets', 'ships'],
] as const;

describe.each(TOP_QUERIES)('%s', (fn, statType) => {
  const call = (filter?: string | null) =>
    (FactionStats[fn] as (id: number, f?: string | null) => Promise<unknown>)(
      AMARR,
      filter,
    );

  it('serves a cache hit without touching the database', async () => {
    redis.get.mockResolvedValue(JSON.stringify([{ killCount: 7 }]));

    await expect(call('LAST_7_DAYS')).resolves.toEqual([{ killCount: 7 }]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('keys the cache on faction, stat type and filter', async () => {
    await call('LAST_7_DAYS');

    expect(redis.get).toHaveBeenCalledWith(
      `faction_stats:${AMARR}:${statType}:LAST_7_DAYS`,
    );
  });

  it('keys a missing filter as ALL_TIME', async () => {
    await call(null);

    expect(redis.get).toHaveBeenCalledWith(
      `faction_stats:${AMARR}:${statType}:ALL_TIME`,
    );
  });

  it.each([
    ['TODAY', 120],
    ['LAST_7_DAYS', 300],
    ['LAST_90_DAYS', 900],
    [null, 3600],
  ])('caches %s for %i seconds', async (filter, ttl) => {
    await call(filter);

    expect(redis.setex).toHaveBeenCalledWith(
      expect.any(String),
      ttl,
      expect.any(String),
    );
  });

  it('binds the faction id rather than interpolating it', async () => {
    await call('LAST_7_DAYS');

    expect(queryValues()).toContain(AMARR);
    expect(querySql()).not.toContain(String(AMARR));
  });

  it('narrows to the faction through the GIN-indexed array', async () => {
    await call('LAST_7_DAYS');

    expect(querySql()).toContain('ANY(kf.attacker_faction_ids)');
  });
});

describe('the attacker-side queries', () => {
  it.each([
    'getFactionTopCharacters',
    'getFactionTopCorporations',
    'getFactionTopShips',
  ] as const)(
    '%s counts only attackers who fought for the faction',
    async (fn) => {
      await FactionStats[fn](AMARR, 'LAST_7_DAYS');

      // The array says which factions were on the killmail, not which pilot
      // fought for which one.
      expect(querySql()).toContain('a.faction_id = ?');
    },
  );

  it('converts BigInt counts before caching', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        character_id: 90000001,
        character_name: 'Pilot',
        security_status: -1.2,
        corporation_id: 1000179,
        alliance_id: null,
        kill_count: 42n,
      },
    ]);

    const result = await FactionStats.getFactionTopCharacters(AMARR, null);

    expect(result).toEqual([
      {
        killCount: 42,
        character: {
          id: 90000001,
          name: 'Pilot',
          security_status: -1.2,
          corporation_id: 1000179,
          alliance_id: null,
        },
      },
    ]);
    expect(() => JSON.parse(redis.setex.mock.calls[0][2])).not.toThrow();
  });

  it('counts a corporation once per killmail, not once per pilot', async () => {
    await FactionStats.getFactionTopCorporations(AMARR, null);

    expect(querySql()).toContain('COUNT(DISTINCT kf.killmail_id)');
  });
});

describe('getFactionTopFactionTargets', () => {
  it('leaves out the faction itself and the Unknown placeholder', async () => {
    await FactionStats.getFactionTopFactionTargets(AMARR, null);

    expect(querySql()).toContain('kf.victim_faction_id <> ?');
    expect(queryValues().filter((v) => v === AMARR).length).toBe(2);
    expect(queryValues()).toContain(500021);
  });

  it('maps rows to a faction and a numeric count', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        victim_faction_id: 500001,
        faction_name: 'Caldari State',
        kill_count: 3n,
      },
    ]);

    await expect(
      FactionStats.getFactionTopFactionTargets(AMARR, null),
    ).resolves.toEqual([
      { killCount: 3, faction: { id: 500001, name: 'Caldari State' } },
    ]);
  });
});

describe('the counters', () => {
  it('counts only player corporations, matching the Members tab', async () => {
    prisma.corporation.count.mockResolvedValue(457);

    await expect(FactionStats.getMemberCorporationCount(AMARR)).resolves.toBe(
      457,
    );
    expect(prisma.corporation.count).toHaveBeenCalledWith({
      where: { faction_id: AMARR, id: { gte: 2000000 } },
    });
  });

  it.each([
    ['getMemberCorporationCount', 'member_corporations'],
    ['getMemberCharacterCount', 'member_characters'],
    ['getSovereigntySystemCount', 'sov_systems'],
  ] as const)('%s caches under %s for two hours', async (fn, counter) => {
    await FactionStats[fn](AMARR);

    expect(redis.setex).toHaveBeenCalledWith(
      `faction_stats:${AMARR}:${counter}`,
      7200,
      expect.any(String),
    );
  });

  it('treats a cached zero as a hit', async () => {
    redis.get.mockResolvedValue('0');

    await expect(FactionStats.getSovereigntySystemCount(AMARR)).resolves.toBe(
      0,
    );
    expect(prisma.sovereigntyMapCurrent.count).not.toHaveBeenCalled();
  });

  it('counts characters and sovereignty systems by faction_id', async () => {
    await FactionStats.getMemberCharacterCount(AMARR);
    await FactionStats.getSovereigntySystemCount(AMARR);

    expect(prisma.character.count).toHaveBeenCalledWith({
      where: { faction_id: AMARR },
    });
    expect(prisma.sovereigntyMapCurrent.count).toHaveBeenCalledWith({
      where: { faction_id: AMARR },
    });
  });
});
