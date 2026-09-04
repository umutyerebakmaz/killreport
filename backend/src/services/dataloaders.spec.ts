import DataLoader from 'dataloader';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const { prismaMock, MODELS } = vi.hoisted(() => {
  const MODELS = [
    'alliance',
    'corporation',
    'character',
    'race',
    'bloodline',
    'region',
    'constellation',
    'solarSystem',
    'category',
    'itemGroup',
    'type',
    'victim',
    'attacker',
    'killmailItem',
    'marketPrice',
    'stargate',
    'star',
    'planet',
    'station',
    'moon',
    'asteroidBelt',
    'typeDogmaAttribute',
    'typeDogmaEffect',
    'corporationSnapshot',
    'allianceSnapshot',
  ] as const;
  const prismaMock = Object.fromEntries(
    MODELS.map((name) => [name, { findMany: vi.fn() }]),
  ) as Record<(typeof MODELS)[number], { findMany: ReturnType<typeof vi.fn> }>;
  return { prismaMock, MODELS };
});

type Model = (typeof MODELS)[number];

vi.mock('./prisma', () => ({ default: prismaMock }));
vi.mock('./logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import * as loaders from './dataloaders';

function findMany(model: Model) {
  return prismaMock[model].findMany;
}

function whereOf(model: Model, call = 0) {
  return findMany(model).mock.calls[call][0].where;
}

let consoleLog: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  consoleLog.mockRestore();
});

beforeEach(() => {
  for (const name of MODELS) findMany(name).mockResolvedValue([]);
});

/**
 * Loaders that map one key to one row (or null). `keyField` is the column the
 * WHERE ... IN targets and the column the result is keyed on.
 */
const ONE_ROW_LOADERS: Array<{
  name: string;
  create: () => DataLoader<number, any>;
  model: Model;
  keyField: string;
  extraWhere?: Record<string, unknown>;
}> = [
  {
    name: 'alliance',
    create: loaders.createAllianceLoader,
    model: 'alliance',
    keyField: 'id',
  },
  {
    name: 'corporation',
    create: loaders.createCorporationLoader,
    model: 'corporation',
    keyField: 'id',
  },
  {
    name: 'character',
    create: loaders.createCharacterLoader,
    model: 'character',
    keyField: 'id',
  },
  {
    name: 'race',
    create: loaders.createRaceLoader,
    model: 'race',
    keyField: 'id',
  },
  {
    name: 'bloodline',
    create: loaders.createBloodlineLoader,
    model: 'bloodline',
    keyField: 'id',
  },
  {
    name: 'region',
    create: loaders.createRegionLoader,
    model: 'region',
    keyField: 'id',
  },
  {
    name: 'constellation',
    create: loaders.createConstellationLoader,
    model: 'constellation',
    keyField: 'id',
  },
  {
    name: 'solarSystem',
    create: loaders.createSolarSystemLoader,
    model: 'solarSystem',
    keyField: 'id',
  },
  {
    name: 'category',
    create: loaders.createCategoryLoader,
    model: 'category',
    keyField: 'id',
  },
  {
    name: 'itemGroup',
    create: loaders.createItemGroupLoader,
    model: 'itemGroup',
    keyField: 'id',
  },
  {
    name: 'type',
    create: loaders.createTypeLoader,
    model: 'type',
    keyField: 'id',
  },
  {
    name: 'stargate',
    create: loaders.createStargateLoader,
    model: 'stargate',
    keyField: 'id',
  },
  {
    name: 'planet',
    create: loaders.createPlanetLoader,
    model: 'planet',
    keyField: 'id',
  },
  {
    name: 'victim',
    create: loaders.createVictimLoader,
    model: 'victim',
    keyField: 'killmail_id',
  },
  {
    name: 'marketPrice',
    create: loaders.createMarketPriceLoader,
    model: 'marketPrice',
    keyField: 'type_id',
  },
  {
    name: 'starBySystem',
    create: loaders.createStarBySystemLoader,
    model: 'star',
    keyField: 'solar_system_id',
  },
  {
    name: 'finalBlow',
    create: loaders.createFinalBlowLoader,
    model: 'attacker',
    keyField: 'killmail_id',
    extraWhere: { final_blow: true },
  },
];

describe.each(ONE_ROW_LOADERS)(
  '$name loader',
  ({ create, model, keyField, extraWhere }) => {
    it('batches one findMany, returns rows in key order and null for misses', async () => {
      const row1 = { [keyField]: 1, tag: 'one' };
      const row3 = { [keyField]: 3, tag: 'three' };
      findMany(model).mockResolvedValue([row1, row3]);

      const loader = create();
      const results = await Promise.all([
        loader.load(3),
        loader.load(1),
        loader.load(2),
      ]);

      expect(results).toEqual([row3, row1, null]);
      expect(findMany(model)).toHaveBeenCalledTimes(1);
      expect(whereOf(model)[keyField]).toEqual({ in: [3, 1, 2] });
      if (extraWhere) expect(whereOf(model)).toMatchObject(extraWhere);
    });

    it('dedupes a key within a tick and serves it from cache afterwards', async () => {
      const row = { [keyField]: 7 };
      findMany(model).mockResolvedValue([row]);

      const loader = create();
      const [a, b] = await Promise.all([loader.load(7), loader.load(7)]);
      const c = await loader.load(7);

      expect(a).toBe(row);
      expect(b).toBe(row);
      expect(c).toBe(row);
      expect(findMany(model)).toHaveBeenCalledTimes(1);
      expect(whereOf(model)[keyField]).toEqual({ in: [7] });
    });
  },
);

/**
 * Loaders that map one key to every row sharing a foreign key. A key with no
 * rows resolves to [] rather than null so an empty relation is not an error.
 */
const MANY_ROW_LOADERS: Array<{
  name: string;
  create: () => DataLoader<number, any[]>;
  model: Model;
  foreignKey: string;
  args?: Record<string, unknown>;
}> = [
  {
    name: 'corporationsByAlliance',
    create: loaders.createCorporationsByAllianceLoader,
    model: 'corporation',
    foreignKey: 'alliance_id',
  },
  {
    name: 'charactersByCorp',
    create: loaders.createCharactersByCorpLoader,
    model: 'character',
    foreignKey: 'corporation_id',
  },
  {
    name: 'constellationsByRegion',
    create: loaders.createConstellationsByRegionLoader,
    model: 'constellation',
    foreignKey: 'region_id',
  },
  {
    name: 'solarSystemsByConstellation',
    create: loaders.createSolarSystemsByConstellationLoader,
    model: 'solarSystem',
    foreignKey: 'constellation_id',
  },
  {
    name: 'itemGroupsByCategory',
    create: loaders.createItemGroupsByCategoryLoader,
    model: 'itemGroup',
    foreignKey: 'category_id',
  },
  {
    name: 'typeDogmaAttributes',
    create: loaders.createTypeDogmaAttributesLoader,
    model: 'typeDogmaAttribute',
    foreignKey: 'type_id',
    args: { include: { attribute: true } },
  },
  {
    name: 'typeDogmaEffects',
    create: loaders.createTypeDogmaEffectsLoader,
    model: 'typeDogmaEffect',
    foreignKey: 'type_id',
    args: { include: { effect: true } },
  },
  {
    name: 'attackers',
    create: loaders.createAttackersLoader,
    model: 'attacker',
    foreignKey: 'killmail_id',
  },
  {
    name: 'items',
    create: loaders.createItemsLoader,
    model: 'killmailItem',
    foreignKey: 'killmail_id',
  },
  {
    name: 'typesByGroup',
    create: loaders.createTypesByGroupLoader,
    model: 'type',
    foreignKey: 'group_id',
    args: { orderBy: { name: 'asc' } },
  },
  {
    name: 'stargatesBySystem',
    create: loaders.createStargatesBySystemLoader,
    model: 'stargate',
    foreignKey: 'solar_system_id',
    args: { orderBy: { id: 'asc' } },
  },
  {
    name: 'planetsBySystem',
    create: loaders.createPlanetsBySystemLoader,
    model: 'planet',
    foreignKey: 'solar_system_id',
    args: { orderBy: [{ orbit_index: 'asc' }, { id: 'asc' }] },
  },
  {
    name: 'stationsBySystem',
    create: loaders.createStationsBySystemLoader,
    model: 'station',
    foreignKey: 'solar_system_id',
    args: { orderBy: { id: 'asc' } },
  },
  {
    name: 'moonsByPlanet',
    create: loaders.createMoonsByPlanetLoader,
    model: 'moon',
    foreignKey: 'planet_id',
    args: { orderBy: [{ orbit_index: 'asc' }, { id: 'asc' }] },
  },
  {
    name: 'asteroidBeltsByPlanet',
    create: loaders.createAsteroidBeltsByPlanetLoader,
    model: 'asteroidBelt',
    foreignKey: 'planet_id',
    args: { orderBy: [{ orbit_index: 'asc' }, { id: 'asc' }] },
  },
];

describe.each(MANY_ROW_LOADERS)(
  '$name loader',
  ({ create, model, foreignKey, args }) => {
    it('groups rows by foreign key in database order and returns [] for a key with no rows', async () => {
      const first20 = { [foreignKey]: 20, n: 1 };
      const only10 = { [foreignKey]: 10, n: 2 };
      const second20 = { [foreignKey]: 20, n: 3 };
      findMany(model).mockResolvedValue([first20, only10, second20]);

      const loader = create();
      const results = await Promise.all([
        loader.load(10),
        loader.load(20),
        loader.load(30),
      ]);

      expect(results).toEqual([[only10], [first20, second20], []]);
      expect(findMany(model)).toHaveBeenCalledTimes(1);
      expect(whereOf(model)[foreignKey]).toEqual({ in: [10, 20, 30] });
      if (args) expect(findMany(model).mock.calls[0][0]).toMatchObject(args);
    });

    it('returns a fresh empty list per missing key rather than null', async () => {
      const loader = create();
      const [a, b] = await Promise.all([loader.load(1), loader.load(2)]);

      expect(a).toEqual([]);
      expect(b).toEqual([]);
      expect(a).not.toBe(b);
    });
  },
);

const SNAPSHOT_LOADERS = [
  {
    name: 'corporationSnapshot',
    create: loaders.createCorporationSnapshotLoader as () => DataLoader<
      any,
      any
    >,
    model: 'corporationSnapshot' as Model,
    idField: 'corporation_id',
    keyName: 'corporationId',
  },
  {
    name: 'allianceSnapshot',
    create: loaders.createAllianceSnapshotLoader as () => DataLoader<any, any>,
    model: 'allianceSnapshot' as Model,
    idField: 'alliance_id',
    keyName: 'allianceId',
  },
];

describe.each(SNAPSHOT_LOADERS)(
  '$name loader',
  ({ create, model, idField, keyName }) => {
    const day = (d: string) => new Date(`${d}T00:00:00Z`);
    const snap = (id: number, date: string) => ({
      [idField]: id,
      snapshot_date: day(date),
    });

    it('returns the newest snapshot on or before each requested date, per entity', async () => {
      const sep01 = snap(1, '2026-09-01');
      const sep03 = snap(1, '2026-09-03');
      const sep05 = snap(1, '2026-09-05');
      // Deliberately unsorted so the per-key sort is exercised, not the orderBy.
      findMany(model).mockResolvedValue([sep03, sep05, sep01]);

      const loader = create();
      const results = await Promise.all([
        loader.load({ [keyName]: 1, date: day('2026-09-04') }),
        loader.load({ [keyName]: 1, date: day('2026-09-01') }),
        loader.load({ [keyName]: 1, date: day('2026-08-20') }),
        loader.load({ [keyName]: 2, date: day('2026-09-04') }),
      ]);

      expect(results).toEqual([sep03, sep01, null, null]);
    });

    it('queries each entity once, bounded below by the earliest requested date', async () => {
      const loader = create();
      await Promise.all([
        loader.load({ [keyName]: 1, date: day('2026-09-04') }),
        loader.load({ [keyName]: 1, date: day('2026-08-20') }),
        loader.load({ [keyName]: 2, date: day('2026-09-01') }),
      ]);

      expect(findMany(model)).toHaveBeenCalledTimes(1);
      const where = whereOf(model);
      expect(where[idField]).toEqual({ in: [1, 2] });
      expect(where.snapshot_date.gte).toEqual(day('2026-08-20'));
      expect(where.snapshot_date.lte).toBeInstanceOf(Date);
    });

    it('treats two keys with the same id and instant as one cache entry', async () => {
      const loader = create();
      await loader.load({ [keyName]: 1, date: day('2026-09-04') });
      await loader.load({ [keyName]: 1, date: day('2026-09-04') });

      expect(findMany(model)).toHaveBeenCalledTimes(1);
    });
  },
);

describe('regionStats loader', () => {
  it('counts constellations per region and sums their solar systems', async () => {
    findMany('constellation').mockResolvedValue([
      { id: 100, region_id: 1 },
      { id: 101, region_id: 1 },
      { id: 200, region_id: 2 },
      { id: 900, region_id: null },
    ]);
    findMany('solarSystem').mockResolvedValue([
      { constellation_id: 100 },
      { constellation_id: 100 },
      { constellation_id: 101 },
      { constellation_id: 200 },
      { constellation_id: null },
    ]);

    const loader = loaders.createRegionStatsLoader();
    const results = await Promise.all([
      loader.load(1),
      loader.load(2),
      loader.load(3),
    ]);

    expect(results).toEqual([
      { constellationCount: 2, solarSystemCount: 3 },
      { constellationCount: 1, solarSystemCount: 1 },
      { constellationCount: 0, solarSystemCount: 0 },
    ]);
    expect(whereOf('constellation').region_id).toEqual({ in: [1, 2, 3] });
    expect(whereOf('solarSystem').constellation_id).toEqual({
      in: [100, 101, 200, 900],
    });
  });
});

/**
 * Both security loaders classify a system the same way: >= 0.5 high, > 0 low,
 * <= 0 null, and a missing security_status is a wormhole that stays out of
 * the average.
 */
const MIXED_SYSTEMS = [1.0, 0.5, 0.4, 0.1, 0.0, -0.3, null];
const MIXED_STATS = {
  highSec: 2,
  lowSec: 2,
  nullSec: 2,
  wormhole: 1,
  avgSecurity: (1.0 + 0.5 + 0.4 + 0.1 + 0.0 - 0.3) / 6,
};
const EMPTY_STATS = {
  highSec: 0,
  lowSec: 0,
  nullSec: 0,
  wormhole: 0,
  avgSecurity: null,
};

describe('constellationSecurityStats loader', () => {
  it('classifies systems by security band and averages the non-wormhole ones', async () => {
    findMany('solarSystem').mockResolvedValue([
      ...MIXED_SYSTEMS.map((security_status) => ({
        constellation_id: 10,
        security_status,
      })),
      { constellation_id: 20, security_status: 0.7 },
      { constellation_id: null, security_status: 0.9 },
    ]);

    const loader = loaders.createConstellationSecurityStatsLoader();
    const [mixed, single, empty] = await Promise.all([
      loader.load(10),
      loader.load(20),
      loader.load(30),
    ]);

    expect(mixed).toMatchObject({
      highSec: 2,
      lowSec: 2,
      nullSec: 2,
      wormhole: 1,
    });
    expect(mixed.avgSecurity).toBeCloseTo(MIXED_STATS.avgSecurity, 10);
    expect(single).toEqual({
      highSec: 1,
      lowSec: 0,
      nullSec: 0,
      wormhole: 0,
      avgSecurity: 0.7,
    });
    expect(empty).toEqual(EMPTY_STATS);
    expect(whereOf('solarSystem').constellation_id).toEqual({
      in: [10, 20, 30],
    });
  });
});

describe('regionSecurityStats loader', () => {
  it('rolls systems up through their constellation to the region', async () => {
    findMany('constellation').mockResolvedValue([
      { id: 100, region_id: 1 },
      { id: 101, region_id: 1 },
      { id: 200, region_id: 2 },
    ]);
    findMany('solarSystem').mockResolvedValue([
      ...MIXED_SYSTEMS.slice(0, 4).map((security_status) => ({
        constellation_id: 100,
        security_status,
      })),
      ...MIXED_SYSTEMS.slice(4).map((security_status) => ({
        constellation_id: 101,
        security_status,
      })),
      { constellation_id: 200, security_status: -0.1 },
      { constellation_id: 999, security_status: 1.0 },
    ]);

    const loader = loaders.createRegionSecurityStatsLoader();
    const [mixed, single, empty] = await Promise.all([
      loader.load(1),
      loader.load(2),
      loader.load(3),
    ]);

    expect(mixed).toMatchObject({
      highSec: 2,
      lowSec: 2,
      nullSec: 2,
      wormhole: 1,
    });
    expect(mixed.avgSecurity).toBeCloseTo(MIXED_STATS.avgSecurity, 10);
    expect(single).toEqual({
      highSec: 0,
      lowSec: 0,
      nullSec: 1,
      wormhole: 0,
      avgSecurity: -0.1,
    });
    expect(empty).toEqual(EMPTY_STATS);
    expect(whereOf('solarSystem').constellation_id).toEqual({
      in: [100, 101, 200],
    });
  });
});

describe('createDataLoaders', () => {
  it('builds every loader the resolvers expect', () => {
    const { loaders: ctx } = loaders.createDataLoaders();

    expect(Object.keys(ctx).sort()).toEqual(
      [
        'alliance',
        'allianceSnapshot',
        'asteroidBeltsByPlanet',
        'attackers',
        'bloodline',
        'category',
        'character',
        'charactersByCorp',
        'constellation',
        'constellationSecurityStats',
        'constellationsByRegion',
        'corporation',
        'corporationSnapshot',
        'corporationsByAlliance',
        'finalBlow',
        'itemGroup',
        'itemGroupsByCategory',
        'items',
        'marketPrice',
        'moonsByPlanet',
        'planet',
        'planetsBySystem',
        'race',
        'region',
        'regionSecurityStats',
        'regionStats',
        'solarSystem',
        'solarSystemsByConstellation',
        'starBySystem',
        'stargate',
        'stargatesBySystem',
        'stationsBySystem',
        'type',
        'typeDogmaAttributes',
        'typeDogmaEffects',
        'typesByGroup',
        'victim',
      ].sort(),
    );
    for (const loader of Object.values(ctx))
      expect(loader).toBeInstanceOf(DataLoader);
  });

  it('returns fresh instances per call so no cache leaks between requests', () => {
    const a = loaders.createDataLoaders().loaders;
    const b = loaders.createDataLoaders().loaders;

    for (const key of Object.keys(a) as Array<keyof typeof a>) {
      expect(a[key]).not.toBe(b[key]);
    }
  });
});
