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
import {
  getMapLabels,
  labelsCacheKey,
  LABELS_CACHE_TTL_SECONDS,
} from './map-labels.service';

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
    expect(labelsCacheKey('NEW_EDEN', 'REGION')).toBe(
      'map:labels:NEW_EDEN:REGION',
    );
    expect(labelsCacheKey('POCHVEN', 'CONSTELLATION')).toBe(
      'map:labels:POCHVEN:CONSTELLATION',
    );
  });

  it('never collides across the two tiers of one scene', () => {
    expect(labelsCacheKey('NEW_EDEN', 'REGION')).not.toBe(
      labelsCacheKey('NEW_EDEN', 'CONSTELLATION'),
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

    const labels = await getMapLabels('NEW_EDEN', 'REGION');

    expect(labels).toHaveLength(1);
    expect(labels[0].name).toBe('The Forge');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('queries and caches on a miss, at the static TTL', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { id: 20000020, name: 'Kimotoro', x: 1.5e17, z: -2.5e17 },
    ]);

    const labels = await getMapLabels('NEW_EDEN', 'CONSTELLATION');

    expect(labels).toEqual([
      {
        id: 20000020,
        name: 'Kimotoro',
        kind: 'CONSTELLATION',
        x: 1.5e17,
        z: -2.5e17,
      },
    ]);
    expect(redis.setex).toHaveBeenCalledWith(
      'map:labels:NEW_EDEN:CONSTELLATION',
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

    const labels = await getMapLabels('WORMHOLE', 'REGION');

    expect(labels.map((l) => l.kind)).toEqual(['REGION', 'REGION']);
  });

  it('returns an empty list rather than throwing when a scene has no rows', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await expect(getMapLabels('POCHVEN', 'CONSTELLATION')).resolves.toEqual([]);
  });

  it('caches an empty result too, so an empty scene is not re-queried', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await getMapLabels('POCHVEN', 'REGION');
    expect(redis.setex).toHaveBeenCalledTimes(1);
  });

  it('carries the gateless filter into NEW_EDEN and leaves it out elsewhere', async () => {
    // The service's own docstring is the reason this is pinned: NEW_EDEN drops
    // 217 gateless Jove systems, and a label query that skipped the filter
    // would shift every region centroid away from what the geometry draws.
    // Wormhole systems have no gates at all, so the same clause would empty
    // that scene entirely.
    prisma.$queryRaw.mockResolvedValue([]);

    await getMapLabels('NEW_EDEN', 'REGION');
    expect(lastQueryText()).toContain(
      'EXISTS (SELECT 1 FROM stargates g WHERE g.solar_system_id = s.system_id)',
    );

    prisma.$queryRaw.mockClear();
    await getMapLabels('WORMHOLE', 'REGION');
    expect(lastQueryText()).not.toContain('stargates');
  });

  it('averages member positions for a region and reads the stored one for a constellation', async () => {
    // A region has no position of its own, so the centroid is computed. A
    // constellation does, measured to sit within 0.23 ly of its members'
    // centroid, so averaging it would be work for nothing.
    prisma.$queryRaw.mockResolvedValue([]);

    await getMapLabels('NEW_EDEN', 'REGION');
    expect(lastQueryText()).toContain('AVG(s.position_x)');
    expect(lastQueryText()).toContain('AVG(s.position_z)');

    prisma.$queryRaw.mockClear();
    await getMapLabels('NEW_EDEN', 'CONSTELLATION');
    expect(lastQueryText()).not.toContain('AVG');
    expect(lastQueryText()).toContain('c.position_x AS x');
  });

  it('runs one query, not one per row', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { id: 1, name: 'A', x: 0, z: 0 },
      { id: 2, name: 'B', x: 1, z: 1 },
      { id: 3, name: 'C', x: 2, z: 2 },
    ]);
    await getMapLabels('NEW_EDEN', 'REGION');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
