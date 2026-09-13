import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The fifth read service. Redis get, $queryRaw, Redis setex — the same three
 * beats as the other four — plus the two things unique to this one: the scope
 * predicate, and the guarantee that every edge endpoint is also a node.
 */

const { prisma, redis } = vi.hoisted(() => ({
  prisma: { $queryRaw: vi.fn() },
  redis: { get: vi.fn(), setex: vi.fn() },
}));

vi.mock('@services/prisma', () => ({ default: prisma }));
vi.mock('@services/redis', () => ({ default: redis, redis }));

import {
  computeBounds,
  getMapGeometry,
  type MapNode,
} from './universe-map.service';

/** A node row as the query returns it: raw metres, security already truncated. */
function nodeRow(overrides: Record<string, unknown> = {}) {
  return {
    system_id: 30000142,
    name: 'Jita',
    x: -1.2955e17,
    z: 4.3236e16,
    radius: 3.8809e12,
    security_status: 0.94,
    constellation_id: 20000020,
    region_id: 10000002,
    ...overrides,
  };
}

/** The SQL of the nth $queryRaw call, whitespace collapsed. */
function querySql(call: number) {
  const [strings, ...values] = prisma.$queryRaw.mock.calls[call] as [
    TemplateStringsArray,
    ...{ strings?: string[] }[],
  ];
  // Prisma.sql fragments arrive as values; splice their own text back in so the
  // predicate is visible to the assertion.
  return strings
    .map((part, i) => part + (values[i]?.strings?.join('') ?? ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

beforeEach(() => {
  redis.get.mockResolvedValue(null);
  redis.setex.mockResolvedValue('OK');
  prisma.$queryRaw.mockResolvedValue([]);
});

describe('getMapGeometry', () => {
  it('serves a cache hit without touching the database', async () => {
    const cached = { scope: 'NEW_EDEN', nodes: [], edges: [], bounds: {} };
    redis.get.mockResolvedValue(JSON.stringify(cached));

    await expect(getMapGeometry('NEW_EDEN')).resolves.toEqual(cached);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it('keys the cache on the scope and caches for a day', async () => {
    await getMapGeometry('POCHVEN');

    expect(redis.get).toHaveBeenCalledWith('map:geometry:POCHVEN');
    expect(redis.setex).toHaveBeenCalledWith(
      'map:geometry:POCHVEN',
      86400,
      expect.any(String),
    );
  });

  it('gives each scope its own key', async () => {
    await getMapGeometry('WORMHOLE');
    expect(redis.get).toHaveBeenCalledWith('map:geometry:WORMHOLE');
  });

  it('excludes Pochven and gateless systems from NEW_EDEN', async () => {
    await getMapGeometry('NEW_EDEN');

    const sql = querySql(0);
    expect(sql).toContain('c.region_id BETWEEN 10000001 AND 10999999');
    expect(sql).toContain('c.region_id <> 10000070');
    expect(sql).toContain('EXISTS (SELECT 1 FROM stargates g');
  });

  it('keeps gateless systems in POCHVEN and WORMHOLE', async () => {
    await getMapGeometry('POCHVEN');
    expect(querySql(0)).toContain('c.region_id = 10000070');
    expect(querySql(0)).not.toContain('EXISTS (SELECT 1 FROM stargates g');

    prisma.$queryRaw.mockClear();
    await getMapGeometry('WORMHOLE');
    expect(querySql(0)).toContain('c.region_id BETWEEN 11000001 AND 11999999');
    expect(querySql(0)).not.toContain('EXISTS (SELECT 1 FROM stargates g');
  });

  it('uses the mapped primary key names, never bare id', async () => {
    await getMapGeometry('NEW_EDEN');
    const sql = querySql(0);
    expect(sql).toContain('s.system_id');
    expect(sql).toContain('c.constellation_id = s.constellation_id');
    expect(sql).not.toMatch(/\bs\.id\b/);
    expect(sql).not.toMatch(/\bc\.id\b/);
  });

  it('truncates security in SQL and casts it back to a float', async () => {
    await getMapGeometry('NEW_EDEN');
    expect(querySql(0)).toContain(
      'TRUNC(scoped.security_status::numeric, 2)::DOUBLE PRECISION',
    );
  });

  it('rounds node coordinates to the 1e9 m grid', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        nodeRow({
          x: 1_234_567_890_123,
          z: -987_654_321_987,
          radius: 1_500_000_001,
        }),
      ])
      .mockResolvedValueOnce([]);

    const { nodes } = await getMapGeometry('NEW_EDEN');

    expect(nodes[0].x).toBe(1_235_000_000_000);
    expect(nodes[0].z).toBe(-988_000_000_000);
    expect(nodes[0].radius).toBe(2_000_000_000);
  });

  it('maps snake_case columns to the camelCase node shape', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([nodeRow()])
      .mockResolvedValueOnce([]);

    const { nodes } = await getMapGeometry('NEW_EDEN');

    expect(nodes[0]).toEqual({
      systemId: 30000142,
      name: 'Jita',
      x: -129550000000000000,
      z: 43236000000000000,
      radius: 3881000000000,
      securityStatus: 0.94,
      constellationId: 20000020,
      regionId: 10000002,
    });
  });

  it('emits each gate pair once, from < to', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { a: 30000142, b: 30000144 },
      { a: 30000001, b: 30000142 },
    ]);

    const { edges } = await getMapGeometry('NEW_EDEN');

    expect(edges).toEqual([
      { from: 30000142, to: 30000144 },
      { from: 30000001, to: 30000142 },
    ]);
    expect(querySql(1)).toContain('SELECT DISTINCT');
    expect(querySql(1)).toContain(
      'LEAST(g.solar_system_id, g.destination_system_id)',
    );
  });

  it('restricts both edge endpoints with the same predicate as the nodes', async () => {
    await getMapGeometry('NEW_EDEN');
    const edgeSql = querySql(1);

    expect(edgeSql).toContain(
      'g.solar_system_id IN (SELECT system_id FROM scoped)',
    );
    expect(edgeSql).toContain(
      'g.destination_system_id IN (SELECT system_id FROM scoped)',
    );
    expect(edgeSql).toContain('c.region_id <> 10000070');
  });

  it('guards every nullable column the schema declares non-null, in both CTEs', async () => {
    // position_x, position_z and security_status are all Float? in Prisma and
    // Float! in the schema. TRUNC(NULL::numeric, 2) is NULL, so one unguarded
    // null would fail MapGeometry! and — because setex runs before GraphQL
    // serialisation — sit in the cache for a day. Both CTEs need all three or
    // they select different system sets, and then an edge can name a system the
    // node list dropped.
    await getMapGeometry('NEW_EDEN');

    for (const call of [0, 1]) {
      const sql = querySql(call);
      expect(sql).toContain('AND s.position_x IS NOT NULL');
      expect(sql).toContain('AND s.position_z IS NOT NULL');
      expect(sql).toContain('AND s.security_status IS NOT NULL');
    }
  });

  it('derives bounds from the nodes it returns', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        nodeRow({ system_id: 1, x: -2e17, z: 1e17 }),
        nodeRow({ system_id: 2, x: 3e17, z: -4e17 }),
      ])
      .mockResolvedValueOnce([]);

    const { bounds } = await getMapGeometry('NEW_EDEN');

    expect(bounds).toEqual({
      minX: -2e17,
      maxX: 3e17,
      minZ: -4e17,
      maxZ: 1e17,
    });
  });

  it('caches a JSON-serialisable body — no BigInt, no Decimal', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([nodeRow()])
      .mockResolvedValueOnce([{ a: 1, b: 2 }]);

    await getMapGeometry('NEW_EDEN');

    const [, , body] = redis.setex.mock.calls[0];
    expect(() => JSON.parse(body as string)).not.toThrow();
    expect(JSON.parse(body as string).scope).toBe('NEW_EDEN');
  });
});

describe('computeBounds', () => {
  const node = (x: number, z: number): MapNode => ({
    systemId: 1,
    name: 'x',
    x,
    z,
    radius: 0,
    securityStatus: 0,
    constellationId: 1,
    regionId: 1,
  });

  it('spans every node', () => {
    expect(computeBounds([node(-1, 5), node(7, -3), node(2, 2)])).toEqual({
      minX: -1,
      maxX: 7,
      minZ: -3,
      maxZ: 5,
    });
  });

  it('collapses to zero for an empty scene rather than ±Infinity', () => {
    expect(computeBounds([])).toEqual({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 });
  });

  it('handles a single node without a zero-width span crash downstream', () => {
    expect(computeBounds([node(4, 4)])).toEqual({
      minX: 4,
      maxX: 4,
      minZ: 4,
      maxZ: 4,
    });
  });
});
