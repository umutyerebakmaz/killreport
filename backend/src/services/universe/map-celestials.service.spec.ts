import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The sixth read service. Its shape is the fifth's — Redis, $queryRaw, Redis —
 * with one difference that is the whole point: the cache key is per system, so
 * panning the focus one neighbour along reuses everything it already had.
 */

// The service writes its per-system entries through a pipeline — one round trip
// for up to sixteen keys instead of sixteen — so the mock has to hand back a
// pipeline object and the assertions count calls on ITS setex.
const { prisma, redis, pipelineSetex } = vi.hoisted(() => {
  const pipelineSetex = vi.fn();
  return {
    pipelineSetex,
    prisma: { $queryRaw: vi.fn() },
    redis: {
      mget: vi.fn(),
      get: vi.fn(),
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
  celestialsCacheKey,
  getMapCelestials,
  MAX_CELESTIAL_SYSTEMS,
} from './map-celestials.service';

/** A row as the UNION ALL returns it. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'PLANET',
    id: 40009077,
    solar_system_id: 30000142,
    name: 'Jita I',
    x: 4.1e10,
    z: -2.2e10,
    orbit_index: 1,
    planet_id: null,
    destination_system_id: null,
    ...overrides,
  };
}

function querySql(call = 0) {
  const [strings, ...values] = prisma.$queryRaw.mock.calls[call] as [
    TemplateStringsArray,
    ...{ strings?: string[] }[],
  ];
  return strings
    .map((part, i) => part + (values[i]?.strings?.join('') ?? ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

beforeEach(() => {
  redis.mget.mockResolvedValue([null]);
  prisma.$queryRaw.mockResolvedValue([]);
});

describe('celestialsCacheKey', () => {
  it('keys on the system, so two requests can share a system', () => {
    expect(celestialsCacheKey(30000142)).toBe('map:celestials:30000142');
  });
});

describe('getMapCelestials', () => {
  it('returns nothing for an empty request without touching redis or the database', async () => {
    await expect(getMapCelestials([])).resolves.toEqual([]);
    expect(redis.mget).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('rejects more than sixteen systems rather than silently truncating', async () => {
    const tooMany = Array.from(
      { length: MAX_CELESTIAL_SYSTEMS + 1 },
      (_, i) => i + 1,
    );

    await expect(getMapCelestials(tooMany)).rejects.toThrow(/16/);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('accepts exactly sixteen', async () => {
    const exactly = Array.from(
      { length: MAX_CELESTIAL_SYSTEMS },
      (_, i) => i + 1,
    );
    redis.mget.mockResolvedValue(exactly.map(() => null));

    await expect(getMapCelestials(exactly)).resolves.toEqual([]);
  });

  it('reads every requested system in one mget round trip', async () => {
    redis.mget.mockResolvedValue([null, null]);

    await getMapCelestials([30000142, 30000144]);

    expect(redis.mget).toHaveBeenCalledTimes(1);
    expect(redis.mget).toHaveBeenCalledWith([
      'map:celestials:30000142',
      'map:celestials:30000144',
    ]);
  });

  it('queries only the systems the cache missed', async () => {
    const cached = [row({ solar_system_id: 30000142 })];
    redis.mget.mockResolvedValue([JSON.stringify(cached), null]);

    await getMapCelestials([30000142, 30000144]);

    // The one miss is the only id spliced into the query.
    const [, ...values] = prisma.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    expect(JSON.stringify(values)).toContain('30000144');
    expect(JSON.stringify(values)).not.toContain('30000142');
  });

  it('skips the database entirely when every system is cached', async () => {
    redis.mget.mockResolvedValue([
      JSON.stringify([row({ solar_system_id: 30000142 })]),
      JSON.stringify([row({ solar_system_id: 30000144, id: 2 })]),
    ]);

    const result = await getMapCelestials([30000142, 30000144]);

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(redis.pipeline).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it('caches each missed system separately, under its own key', async () => {
    redis.mget.mockResolvedValue([null, null]);
    prisma.$queryRaw.mockResolvedValue([
      row({ solar_system_id: 30000142 }),
      row({ solar_system_id: 30000144, id: 40009078 }),
    ]);

    await getMapCelestials([30000142, 30000144]);

    expect(redis.pipeline).toHaveBeenCalledTimes(1);
    expect(pipelineSetex).toHaveBeenCalledTimes(2);
    expect(pipelineSetex).toHaveBeenCalledWith(
      'map:celestials:30000142',
      86400,
      expect.any(String),
    );
    expect(pipelineSetex).toHaveBeenCalledWith(
      'map:celestials:30000144',
      86400,
      expect.any(String),
    );
  });

  it('caches an empty list for a system that has nothing, so it is not re-queried', async () => {
    redis.mget.mockResolvedValue([null]);
    prisma.$queryRaw.mockResolvedValue([]);

    await getMapCelestials([30000001]);

    expect(pipelineSetex).toHaveBeenCalledWith(
      'map:celestials:30000001',
      86400,
      '[]',
    );
  });

  it('maps snake_case rows to the camelCase celestial shape', async () => {
    redis.mget.mockResolvedValue([null]);
    prisma.$queryRaw.mockResolvedValue([
      row({
        kind: 'GATE',
        id: 50001248,
        orbit_index: null,
        destination_system_id: 30000144,
      }),
    ]);

    const [celestial] = await getMapCelestials([30000142]);

    expect(celestial).toEqual({
      id: 50001248,
      systemId: 30000142,
      name: 'Jita I',
      kind: 'GATE',
      x: 4.1e10,
      z: -2.2e10,
      orbitIndex: null,
      planetId: null,
      destinationSystemId: 30000144,
    });
  });

  it('reads all six kinds in one query', async () => {
    await getMapCelestials([30000142]);
    const sql = querySql();

    for (const table of [
      'stars',
      'planets',
      'moons',
      'asteroid_belts',
      'stations',
      'stargates',
    ]) {
      expect(sql).toContain(`FROM ${table}`);
    }
    expect(sql.match(/UNION ALL/g)).toHaveLength(5);
  });

  it('uses the mapped primary key names, never a bare id', async () => {
    await getMapCelestials([30000142]);
    const sql = querySql();

    expect(sql).toContain('star_id');
    expect(sql).toContain('planet_id');
    expect(sql).toContain('moon_id');
    expect(sql).toContain('asteroid_belt_id');
    expect(sql).toContain('station_id');
    expect(sql).toContain('stargate_id');
  });

  it('puts the star at the system centre, because ESI gives it no position', async () => {
    await getMapCelestials([30000142]);
    const sql = querySql();

    expect(sql).toMatch(/'STAR'[\s\S]*0::DOUBLE PRECISION AS x/);
  });

  it('filters null positions on every kind that carries one', async () => {
    await getMapCelestials([30000142]);
    const sql = querySql();

    // Five of the six tables have nullable positions; the star is synthesised.
    // MapCelestial.x is Float!, and setex runs before GraphQL serialisation, so
    // one null would poison the system's cache entry for a day.
    expect(
      sql.match(/position_x IS NOT NULL AND \w*\.?position_z IS NOT NULL/g),
    ).toHaveLength(5);
  });

  it('does not round celestial coordinates', async () => {
    redis.mget.mockResolvedValue([null]);
    prisma.$queryRaw.mockResolvedValue([row({ x: 24144560860, z: -1 })]);

    const [celestial] = await getMapCelestials([30000142]);

    // The innermost planet orbits at 2.41e10 m; the node grid of 1e9 m would
    // move it by 4%.
    expect(celestial.x).toBe(24144560860);
    expect(celestial.z).toBe(-1);
  });
});
