import { beforeEach, describe, expect, it, vi } from 'vitest';

const { stats } = vi.hoisted(() => ({
  stats: {
    getMemberCorporationCount: vi.fn(),
    getMemberCharacterCount: vi.fn(),
    getSovereigntySystemCount: vi.fn(),
  },
}));

vi.mock('@services/faction/faction-stats.service', () => stats);

import { factionFields } from './fields';

/**
 * This is where the snake_case -> camelCase mapping for Faction actually
 * lives now — see backend/src/resolvers/faction/queries.ts and
 * backend/src/resolvers/leaderboard/queries.ts, both of which now return
 * the raw Prisma row and rely on these resolvers for corporationId /
 * militiaCorporationId.
 */

/** Calls a field resolver with the parent it reads and no other arguments. */
function resolve(
  field: 'corporationId' | 'militiaCorporationId',
  parent: unknown,
) {
  const resolver = factionFields[field] as (parent: unknown) => unknown;
  return resolver(parent);
}

describe('factionFields.corporationId', () => {
  it('maps corporation_id to corporationId', () => {
    expect(resolve('corporationId', { corporation_id: 1000084 })).toBe(1000084);
  });

  it('is null when the faction has no corporation_id', () => {
    expect(resolve('corporationId', { corporation_id: null })).toBeNull();
    expect(resolve('corporationId', {})).toBeNull();
  });
});

describe('factionFields.militiaCorporationId', () => {
  it('maps militia_corporation_id to militiaCorporationId', () => {
    expect(
      resolve('militiaCorporationId', { militia_corporation_id: 1000179 }),
    ).toBe(1000179);
  });

  it('is null when the faction has no militia_corporation_id', () => {
    expect(
      resolve('militiaCorporationId', { militia_corporation_id: null }),
    ).toBeNull();
    expect(resolve('militiaCorporationId', {})).toBeNull();
  });
});

/** A field resolver called the way Yoga calls it. */
function resolveWith(field: keyof typeof factionFields, parent: unknown) {
  const resolver = factionFields[field] as (
    parent: unknown,
    args: unknown,
    context: unknown,
  ) => unknown;
  return resolver(parent, {}, context);
}

const context = {
  loaders: {
    solarSystem: { load: vi.fn() },
    corporation: { load: vi.fn() },
  },
};

beforeEach(() => {
  context.loaders.solarSystem.load.mockResolvedValue(null);
  context.loaders.corporation.load.mockResolvedValue(null);
});

describe('factionFields relations', () => {
  it('loads the home system through the DataLoader', async () => {
    const system = { system_id: 30002187, name: 'Amarr' };
    context.loaders.solarSystem.load.mockResolvedValue(system);

    await expect(
      resolveWith('solarSystem', { solar_system_id: 30002187 }),
    ).resolves.toBe(system);
    expect(context.loaders.solarSystem.load).toHaveBeenCalledWith(30002187);
  });

  it.each(['solarSystem', 'corporation', 'militiaCorporation'] as const)(
    '%s is null without calling the loader when the id is null',
    async (field) => {
      await expect(resolveWith(field, {})).resolves.toBeNull();
      expect(context.loaders.solarSystem.load).not.toHaveBeenCalled();
      expect(context.loaders.corporation.load).not.toHaveBeenCalled();
    },
  );

  it('is null when the corporation is not in the database', async () => {
    await expect(
      resolveWith('corporation', { corporation_id: 1000084 }),
    ).resolves.toBeNull();
  });

  it('returns the militia corporation with date_founded as a string', async () => {
    context.loaders.corporation.load.mockResolvedValue({
      id: 1000179,
      name: '24th Imperial Crusade',
      date_founded: new Date('2003-05-06T00:00:00.000Z'),
    });

    await expect(
      resolveWith('militiaCorporation', { militia_corporation_id: 1000179 }),
    ).resolves.toMatchObject({
      id: 1000179,
      date_founded: '2003-05-06T00:00:00.000Z',
    });
  });

  it('maps the station columns', () => {
    const parent = { station_count: 12, station_system_count: 4 };

    expect(resolveWith('stationCount', parent)).toBe(12);
    expect(resolveWith('stationSystemCount', parent)).toBe(4);
    expect(resolveWith('stationCount', {})).toBeNull();
  });
});

describe('factionFields counters', () => {
  it.each([
    ['memberCorporationCount', 'getMemberCorporationCount'],
    ['memberCharacterCount', 'getMemberCharacterCount'],
    ['sovereigntySystemCount', 'getSovereigntySystemCount'],
  ] as const)('%s delegates to %s', async (field, fn) => {
    stats[fn].mockResolvedValue(9);

    await expect(resolveWith(field, { id: 500003 })).resolves.toBe(9);
    expect(stats[fn]).toHaveBeenCalledWith(500003);
  });
});
