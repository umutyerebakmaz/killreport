import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The alliance, corporation and character stats services are three copies of
 * one design: Redis get, a $queryRaw against killmail_filters, Redis setex.
 * Testing them from a single table is what keeps the copies from drifting
 * apart, so every assertion below runs against all three.
 */

const { prisma, redis, sqlFragment } = vi.hoisted(() => ({
  prisma: { $queryRaw: vi.fn() },
  redis: { get: vi.fn(), setex: vi.fn(), keys: vi.fn(), del: vi.fn() },
  // Prisma.sql is a tagged template; the mock keeps the fragment's text so a
  // test can say which time filter was spliced into the query.
  sqlFragment: vi.fn((strings: TemplateStringsArray) => ({
    fragment: strings.join('').trim(),
  })),
}));

vi.mock('@services/prisma', () => ({ default: prisma }));
vi.mock('@services/redis', () => ({ default: redis, redis }));
vi.mock('@generated/prisma/client', () => ({ Prisma: { sql: sqlFragment } }));

import * as allianceStats from './alliance/alliance-stats.service';
import * as characterStats from './character/character-stats.service';
import * as corporationStats from './corporation/corporation-stats.service';

/** The template values $queryRaw was called with, fragment included. */
function queryValues(call = 0) {
  const [, ...values] = prisma.$queryRaw.mock.calls[call] as [
    TemplateStringsArray,
    ...unknown[],
  ];
  return values;
}

function querySql(call = 0) {
  const [strings] = prisma.$queryRaw.mock.calls[call] as [TemplateStringsArray];
  return strings.join(' ? ').replace(/\s+/g, ' ');
}

function fragmentOf(call = 0) {
  const values = queryValues(call);
  const found = values.find(
    (v): v is { fragment: string } =>
      typeof v === 'object' && v !== null && 'fragment' in v,
  );
  return found?.fragment ?? null;
}

const SERVICES = [
  {
    name: 'alliance',
    service: allianceStats,
    prefix: 'alliance_stats',
    invalidate: allianceStats.invalidateAllianceStats,
  },
  {
    name: 'corporation',
    service: corporationStats,
    prefix: 'corp_stats',
    invalidate: corporationStats.invalidateCorporationStats,
  },
  {
    name: 'character',
    service: characterStats,
    prefix: 'char_stats',
    invalidate: characterStats.invalidateCharacterStats,
  },
];

/** The four readers every one of the three services exports, and their stat key. */
const READERS = [
  { fn: 'getTopAllianceTargets', statType: 'alliances', shape: 'alliance' },
  {
    fn: 'getTopCorporationTargets',
    statType: 'corporations',
    shape: 'corporation',
  },
  { fn: 'getTopShipTargets', statType: 'ships', shape: 'shipType' },
  { fn: 'getTopShips', statType: 'top_ships', shape: 'shipType' },
] as const;

beforeEach(() => {
  redis.get.mockResolvedValue(null);
  redis.setex.mockResolvedValue('OK');
  redis.keys.mockResolvedValue([]);
  redis.del.mockResolvedValue(0);
  prisma.$queryRaw.mockResolvedValue([]);
});

describe.each(SERVICES)(
  '$name stats service',
  ({ service, prefix, invalidate }) => {
    describe.each(READERS)('$fn', ({ fn, statType }) => {
      const read = (id: number, filter?: string | null) =>
        (
          service as Record<
            string,
            (id: number, f?: string | null) => Promise<unknown>
          >
        )[fn](id, filter);

      it('serves a cache hit without touching the database', async () => {
        const cachedValue = [{ killCount: 3, alliance: { id: 1 } }];
        redis.get.mockResolvedValue(JSON.stringify(cachedValue));

        await expect(read(99, 'TODAY')).resolves.toEqual(cachedValue);
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
        expect(redis.setex).not.toHaveBeenCalled();
      });

      it('builds a cache key from the entity id, the stat type and the filter', async () => {
        await read(99, 'LAST_7_DAYS');

        expect(redis.get).toHaveBeenCalledWith(
          `${prefix}:99:${statType}:LAST_7_DAYS`,
        );
        expect(redis.setex).toHaveBeenCalledWith(
          `${prefix}:99:${statType}:LAST_7_DAYS`,
          expect.any(Number),
          expect.any(String),
        );
      });

      it('names an absent filter ALL_TIME rather than leaving a hole in the key', async () => {
        await read(99);
        await read(99, null);

        expect(redis.get).toHaveBeenNthCalledWith(
          1,
          `${prefix}:99:${statType}:ALL_TIME`,
        );
        expect(redis.get).toHaveBeenNthCalledWith(
          2,
          `${prefix}:99:${statType}:ALL_TIME`,
        );
      });

      it('keeps two filters of the same query in separate cache entries', async () => {
        await read(99, 'TODAY');
        await read(99, 'LAST_90_DAYS');

        const keys = redis.get.mock.calls.map(([key]) => key);
        expect(new Set(keys).size).toBe(2);
      });

      it('queries with a LIMIT of 10, ordered by the kill count', async () => {
        await read(99, 'ALL_TIME');

        const sql = querySql();
        expect(sql).toContain('ORDER BY kill_count DESC');
        expect(sql).toContain('LIMIT 10');
      });

      it('converts the BIGINT count to a number, which BigInt JSON would refuse', async () => {
        prisma.$queryRaw.mockResolvedValue([
          {
            kill_count: 42n,
            victim_alliance_id: 1,
            victim_corporation_id: 1,
            victim_ship_type_id: 1,
            ship_type_id: 1,
            character_id: 1,
          },
        ]);

        const result = (await read(99, 'TODAY')) as Array<{
          killCount: number;
        }>;

        expect(result[0].killCount).toBe(42);
        expect(typeof result[0].killCount).toBe('number');
        // The cached payload has to survive JSON.stringify.
        expect(() =>
          JSON.parse(redis.setex.mock.calls[0][2] as string),
        ).not.toThrow();
      });
    });

    /**
     * TTL follows how fast the window moves: the narrower the window, the sooner
     * the entry expires.
     */
    const TTLS = [
      { filter: 'TODAY', ttl: 120 },
      { filter: 'LAST_7_DAYS', ttl: 300 },
      { filter: 'LAST_90_DAYS', ttl: 900 },
      { filter: 'ALL_TIME', ttl: 3600 },
      { filter: undefined, ttl: 3600 },
      { filter: 'SOMETHING_ELSE', ttl: 3600 },
    ];

    describe.each(TTLS)('TTL for $filter', ({ filter, ttl }) => {
      it(`expires the entry after ${ttl} seconds`, async () => {
        await service.getTopShipTargets(99, filter);

        expect(redis.setex).toHaveBeenCalledWith(
          expect.any(String),
          ttl,
          expect.any(String),
        );
      });
    });

    /** The time filter is a SQL fragment spliced into the query. */
    const FILTERS = [
      {
        filter: 'TODAY',
        fragment: 'AND DATE(kf.killmail_time) = CURRENT_DATE',
      },
      {
        filter: 'LAST_7_DAYS',
        fragment: "AND kf.killmail_time >= NOW() - INTERVAL '7 days'",
      },
      {
        filter: 'LAST_90_DAYS',
        fragment: "AND kf.killmail_time >= NOW() - INTERVAL '90 days'",
      },
    ];

    describe.each(FILTERS)('time filter $filter', ({ filter, fragment }) => {
      it('splices the matching interval into the query', async () => {
        await service.getTopShipTargets(99, filter);

        expect(fragmentOf()).toBe(fragment);
      });
    });

    it('constrains nothing for ALL_TIME or an unknown filter', async () => {
      await service.getTopShipTargets(99, 'ALL_TIME');
      expect(fragmentOf()).toBe('');

      prisma.$queryRaw.mockClear();
      await service.getTopShipTargets(99, 'NOPE');
      expect(fragmentOf()).toBe('');
    });

    it('passes the entity id to the query as a bound value', async () => {
      await service.getTopShipTargets(4242, 'TODAY');

      expect(queryValues()).toContain(4242);
    });

    describe('invalidate', () => {
      it('deletes every cache entry for the entity in one call', async () => {
        redis.keys.mockResolvedValue([
          `${prefix}:5:ships:TODAY`,
          `${prefix}:5:alliances:ALL_TIME`,
        ]);

        await invalidate(5);

        expect(redis.keys).toHaveBeenCalledWith(`${prefix}:5:*`);
        expect(redis.del).toHaveBeenCalledTimes(1);
        expect(redis.del).toHaveBeenCalledWith(
          `${prefix}:5:ships:TODAY`,
          `${prefix}:5:alliances:ALL_TIME`,
        );
      });

      it('skips the delete when the entity has nothing cached', async () => {
        await invalidate(5);

        expect(redis.del).not.toHaveBeenCalled();
      });

      it('scopes the pattern to one entity, so a neighbour is left alone', async () => {
        await invalidate(5);

        const [pattern] = redis.keys.mock.calls[0];
        expect(pattern).toBe(`${prefix}:5:*`);
        expect(pattern).not.toBe(`${prefix}:*`);
      });
    });
  },
);

describe('row mapping', () => {
  it('maps an alliance target row to its id, name and ticker', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        victim_alliance_id: 99000001,
        alliance_name: 'Test Alliance',
        alliance_ticker: 'TEST',
        kill_count: 7n,
      },
    ]);

    await expect(
      allianceStats.getTopAllianceTargets(1, 'TODAY'),
    ).resolves.toEqual([
      {
        killCount: 7,
        alliance: { id: 99000001, name: 'Test Alliance', ticker: 'TEST' },
      },
    ]);
  });

  it('maps a ship row to its id and name only', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { ship_type_id: 587, ship_name: 'Rifter', kill_count: 3n },
    ]);

    await expect(corporationStats.getTopShips(1, 'TODAY')).resolves.toEqual([
      { killCount: 3, shipType: { id: 587, name: 'Rifter' } },
    ]);
  });

  it('returns an empty list, and caches it, when the query finds nothing', async () => {
    await expect(characterStats.getTopShipTargets(1, 'TODAY')).resolves.toEqual(
      [],
    );
    expect(redis.setex).toHaveBeenCalledWith(expect.any(String), 120, '[]');
  });
});

describe('alliance getTopCharacters', () => {
  const row = {
    character_id: 95465499,
    character_name: 'Pilot',
    security_status: -1.5,
    corp_id: 98000001,
    corp_name: 'Corp',
    alliance_id: 99000001,
    alliance_name: 'Alliance',
    kill_count: 12n,
  };

  it('nests the corporation and alliance the pilot belongs to', async () => {
    prisma.$queryRaw.mockResolvedValue([row]);

    await expect(
      allianceStats.getTopCharacters(99000001, 'TODAY'),
    ).resolves.toEqual([
      {
        killCount: 12,
        character: {
          id: 95465499,
          name: 'Pilot',
          securityStatus: -1.5,
          corporation: { id: 98000001, name: 'Corp' },
          alliance: { id: 99000001, name: 'Alliance' },
        },
      },
    ]);
  });

  it('nulls the corporation and alliance rather than nesting empty objects', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        ...row,
        corp_id: null,
        corp_name: null,
        alliance_id: null,
        alliance_name: null,
      },
    ]);

    const [entry] = (await allianceStats.getTopCharacters(
      1,
      'TODAY',
    )) as Array<{
      character: { corporation: unknown; alliance: unknown };
    }>;

    expect(entry.character.corporation).toBeNull();
    expect(entry.character.alliance).toBeNull();
  });

  it('caches under a characters stat key', async () => {
    await allianceStats.getTopCharacters(7, 'TODAY');

    expect(redis.get).toHaveBeenCalledWith('alliance_stats:7:characters:TODAY');
  });
});
