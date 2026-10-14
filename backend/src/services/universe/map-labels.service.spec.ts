import { beforeEach, describe, expect, it, vi } from 'vitest';

// Vitest hoists vi.mock calls above plain const declarations, so a factory
// referencing an unprefixed outer variable hits a TDZ error unless the
// variable is created through vi.hoisted (see map-celestials.service.spec.ts
// for the same pattern).
const { redis, prisma } = vi.hoisted(() => ({
  redis: { get: vi.fn(), setex: vi.fn() },
  prisma: { $queryRaw: vi.fn() },
}));
vi.mock('@services/redis', () => ({ default: redis, redis }));
vi.mock('@services/prisma', () => ({ default: prisma, prisma }));

import { Prisma } from '@generated/prisma/client';
import { labelsCacheKey } from './map-cache-keys';
import { getMapLabels, LABELS_CACHE_TTL_SECONDS } from './map-labels.service';

/**
 * The SQL the service actually handed Prisma. A `Prisma.Sql` flattens its
 * nested fragments into `.sql`, so the scene predicate and the gateless filter
 * are visible in the text even though they arrive as separate objects.
 */
function lastQueryText(): string {
  return (prisma.$queryRaw.mock.calls[0][0] as Prisma.Sql).sql;
}

beforeEach(() => {
  redis.get.mockReset();
  redis.setex.mockReset();
  prisma.$queryRaw.mockReset();
  redis.get.mockResolvedValue(null);
});

describe('labelsCacheKey', () => {
  it('keys on both the scene and the tier', () => {
    // One key per (scope, kind): a shared key would serve Pochven's regions
    // to New Eden, and a key without the kind would serve 114 regions where
    // 1,184 constellations were asked for.
    expect(labelsCacheKey('NEW_EDEN', 'REGION', 'GALACTIC')).toBe(
      'map:labels:v3:NEW_EDEN:REGION:GALACTIC',
    );
    expect(labelsCacheKey('POCHVEN', 'CONSTELLATION', 'GALACTIC')).toBe(
      'map:labels:v3:POCHVEN:CONSTELLATION:GALACTIC',
    );
  });

  it('never collides across the two tiers of one scene', () => {
    expect(labelsCacheKey('NEW_EDEN', 'REGION', 'GALACTIC')).not.toBe(
      labelsCacheKey('NEW_EDEN', 'CONSTELLATION', 'GALACTIC'),
    );
  });
});

describe('labels by projection', () => {
  it('keys the labels on the projection', () => {
    expect(labelsCacheKey('NEW_EDEN', 'REGION', 'SCHEMATIC')).toBe(
      'map:labels:v3:NEW_EDEN:REGION:SCHEMATIC',
    );
    expect(labelsCacheKey('NEW_EDEN', 'REGION', 'SCHEMATIC')).not.toBe(
      labelsCacheKey('NEW_EDEN', 'REGION', 'GALACTIC'),
    );
  });

  it('anchors SCHEMATIC regions on the schematic columns', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await getMapLabels('NEW_EDEN', 'REGION', 'SCHEMATIC');
    const sql = lastQueryText();
    expect(sql).toContain('s.position_2d_x');
    expect(sql).toContain('s.position_2d_y');
    expect(sql).not.toContain('s.position_x');
  });

  it('puts a SCHEMATIC constellation at the mean of its systems', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await getMapLabels('NEW_EDEN', 'CONSTELLATION', 'SCHEMATIC');
    const sql = lastQueryText();
    expect(sql).toContain('AVG(s.position_2d_x)');
    expect(sql).toContain('AVG(s.position_2d_y)');
    expect(sql).not.toContain('c.position_x');
  });

  it('keeps the constellation own position for GALACTIC', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await getMapLabels('NEW_EDEN', 'CONSTELLATION', 'GALACTIC');
    expect(lastQueryText()).toContain('c.position_x AS x');
  });

  it('answers WORMHOLE labels in GALACTIC', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await getMapLabels('WORMHOLE', 'REGION', 'SCHEMATIC');
    expect(redis.get).toHaveBeenCalledWith(
      'map:labels:v3:WORMHOLE:REGION:GALACTIC',
    );
  });
});

describe('getMapLabels', () => {
  it('returns the cached value without touching the database', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify([
        { id: 10000002, name: 'The Forge', kind: 'REGION', x: 1e17, z: -2e17 },
      ]),
    );

    const labels = await getMapLabels('NEW_EDEN', 'REGION', 'GALACTIC');

    expect(labels).toHaveLength(1);
    expect(labels[0].name).toBe('The Forge');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('queries and caches on a miss, at the static TTL', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { id: 20000020, name: 'Kimotoro', x: 1.5e17, z: -2.5e17 },
    ]);

    const labels = await getMapLabels('NEW_EDEN', 'CONSTELLATION', 'GALACTIC');

    expect(labels).toEqual([
      {
        id: 20000020,
        name: 'Kimotoro',
        kind: 'CONSTELLATION',
        x: 1.5e17,
        z: -2.5e17,
        systemId: null,
        bounds: null,
      },
    ]);
    expect(redis.setex).toHaveBeenCalledWith(
      'map:labels:v3:NEW_EDEN:CONSTELLATION:GALACTIC',
      LABELS_CACHE_TTL_SECONDS,
      expect.any(String),
    );
    expect(LABELS_CACHE_TTL_SECONDS).toBe(86400);
  });

  it('stamps the kind onto every row rather than trusting the query', async () => {
    // The SQL selects id/name/x/z; the tier is what the caller asked for, so it
    // is stamped here. A row that carried its own kind could disagree with the
    // cache key it was stored under.
    prisma.$queryRaw.mockResolvedValue([
      { id: 1, name: 'A', x: 0, z: 0 },
      { id: 2, name: 'B', x: 1, z: 1 },
    ]);

    const labels = await getMapLabels('WORMHOLE', 'REGION', 'GALACTIC');

    expect(labels.map((l) => l.kind)).toEqual(['REGION', 'REGION']);
  });

  it('returns an empty list rather than throwing when a scene has no rows', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await expect(
      getMapLabels('POCHVEN', 'CONSTELLATION', 'GALACTIC'),
    ).resolves.toEqual([]);
  });

  it('caches an empty result too, so an empty scene is not re-queried', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await getMapLabels('POCHVEN', 'REGION', 'GALACTIC');
    expect(redis.setex).toHaveBeenCalledTimes(1);
  });

  it('carries the gateless filter into NEW_EDEN and leaves it out elsewhere', async () => {
    // The service's own docstring is the reason this is pinned: NEW_EDEN drops
    // 217 gateless Jove systems, and a label query that skipped the filter
    // would shift every region centroid away from what the geometry draws.
    // Wormhole systems have no gates at all, so the same clause would empty
    // that scene entirely.
    prisma.$queryRaw.mockResolvedValue([]);

    await getMapLabels('NEW_EDEN', 'REGION', 'GALACTIC');
    expect(lastQueryText()).toContain(
      'EXISTS (SELECT 1 FROM stargates g WHERE g.solar_system_id = s.system_id)',
    );

    prisma.$queryRaw.mockClear();
    await getMapLabels('WORMHOLE', 'REGION', 'GALACTIC');
    expect(lastQueryText()).not.toContain('stargates');
  });

  it('reads the stored position for a constellation, not an average', async () => {
    // A constellation has a position of its own, measured to sit within 0.23
    // ly of its members' centroid, so averaging it would be work for nothing.
    prisma.$queryRaw.mockResolvedValue([]);

    await getMapLabels('NEW_EDEN', 'CONSTELLATION', 'GALACTIC');
    expect(lastQueryText()).not.toContain('AVG');
    expect(lastQueryText()).toContain('c.position_x AS x');
  });

  it('derives an extent and a medoid for a region, never an average', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await getMapLabels('NEW_EDEN', 'REGION', 'GALACTIC');

    const sql = lastQueryText();
    expect(sql).toContain('MIN(x)');
    expect(sql).toContain('MAX(x)');
    expect(sql).toContain('MIN(z)');
    expect(sql).toContain('MAX(z)');
    expect(sql).toContain('DISTINCT ON (a.region_id)');
    expect(sql).not.toContain('AVG');
  });

  it('left-joins, so a one-system region still gets a medoid', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await getMapLabels('NEW_EDEN', 'REGION', 'GALACTIC');

    const sql = lastQueryText();
    expect(sql).toContain('LEFT JOIN scene b');
    expect(sql).toContain('COALESCE(SUM(');
  });

  it('breaks a tied medoid on the system id, so the anchor is deterministic', async () => {
    // For a two-system region the tie is guaranteed, not theoretical:
    // power(a.x - b.x, 2) and power(b.x - a.x, 2) are bit-identical, so both
    // systems compute the same single-term sum and DISTINCT ON keeps whichever
    // the plan emits first. The anchor is cached for 24 h, so without the
    // tie-breaker the region name jumps between two stars on each rebuild.
    prisma.$queryRaw.mockResolvedValue([]);
    await getMapLabels('NEW_EDEN', 'REGION', 'GALACTIC');

    expect(lastQueryText()).toMatch(
      /ORDER BY a\.region_id,\s*COALESCE\(SUM\([^\n]*\)\), 0\),\s*a\.system_id/,
    );
  });

  it('maps a region row onto systemId and bounds', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 10000002,
        name: 'The Forge',
        system_id: 30000142,
        x: 1,
        z: 2,
        min_x: -10,
        max_x: 10,
        min_z: -20,
        max_z: 20,
      },
    ]);

    const [label] = await getMapLabels('NEW_EDEN', 'REGION', 'GALACTIC');

    expect(label).toEqual({
      id: 10000002,
      name: 'The Forge',
      kind: 'REGION',
      x: 1,
      z: 2,
      systemId: 30000142,
      bounds: { minX: -10, maxX: 10, minZ: -20, maxZ: 20 },
    });
  });

  it('leaves systemId and bounds null on a constellation row', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { id: 20000020, name: 'Kimotoro', x: 1, z: 2 },
    ]);

    const [label] = await getMapLabels('NEW_EDEN', 'CONSTELLATION', 'GALACTIC');

    expect(label.systemId).toBeNull();
    expect(label.bounds).toBeNull();
  });

  it('runs one query, not one per row', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { id: 1, name: 'A', x: 0, z: 0 },
      { id: 2, name: 'B', x: 1, z: 1 },
      { id: 3, name: 'C', x: 2, z: 2 },
    ]);
    await getMapLabels('NEW_EDEN', 'REGION', 'GALACTIC');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
