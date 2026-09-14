import { beforeEach, describe, expect, it, vi } from 'vitest';

// Vitest hoists vi.mock above plain const declarations, so the factory's outer
// variables have to come from vi.hoisted — same pattern as
// map-labels.service.spec.ts.
const { redis, prisma } = vi.hoisted(() => ({
  redis: { get: vi.fn(), setex: vi.fn() },
  prisma: { $queryRaw: vi.fn() },
}));
vi.mock('@services/redis', () => ({ default: redis, redis }));
vi.mock('@services/prisma', () => ({ default: prisma, prisma }));

import {
  getMapSystemDetails,
  systemDetailsCacheKey,
  SYSTEM_DETAILS_CACHE_TTL_SECONDS,
} from './map-system.service';

/** One row shaped the way the SQL returns it, with Jita's real values. */
function jitaRow(over: Record<string, unknown> = {}) {
  return {
    system_id: 30000142,
    name: 'Jita',
    security_status: 0.94,
    constellation_name: 'Kimotoro',
    region_name: 'The Forge',
    // COUNT(*) comes back from $queryRaw as a BigInt.
    gate_count: 7n,
    ship_kills: 4,
    pod_kills: 8,
    npc_kills: 77,
    ship_jumps: 1745,
    snapshot_at: new Date('2026-09-14T09:00:00.000Z'),
    ...over,
  };
}

beforeEach(() => {
  redis.get.mockReset();
  redis.setex.mockReset();
  prisma.$queryRaw.mockReset();
  redis.get.mockResolvedValue(null);
});

describe('systemDetailsCacheKey', () => {
  it('keys on the system id', () => {
    expect(systemDetailsCacheKey(30000142)).toBe('map:system:30000142');
  });
});

describe('getMapSystemDetails', () => {
  it('maps a row to the shape the popup reads', async () => {
    prisma.$queryRaw.mockResolvedValue([jitaRow()]);

    expect(await getMapSystemDetails(30000142)).toEqual({
      systemId: 30000142,
      name: 'Jita',
      securityStatus: 0.94,
      constellationName: 'Kimotoro',
      regionName: 'The Forge',
      gateCount: 7,
      shipKills: 4,
      podKills: 8,
      npcKills: 77,
      shipJumps: 1745,
      snapshotAt: '2026-09-14T09:00:00.000Z',
    });
  });

  it('converts the BigInt gate count, which JSON.stringify would throw on', async () => {
    prisma.$queryRaw.mockResolvedValue([jitaRow()]);

    const details = await getMapSystemDetails(30000142);

    expect(typeof details?.gateCount).toBe('number');
    // The cache write is where a surviving BigInt would actually blow up.
    expect(redis.setex).toHaveBeenCalledOnce();
  });

  it('leaves all four activity numbers null when the system has no snapshot', async () => {
    prisma.$queryRaw.mockResolvedValue([
      jitaRow({
        ship_kills: null,
        pod_kills: null,
        npc_kills: null,
        ship_jumps: null,
        snapshot_at: null,
      }),
    ]);

    const details = await getMapSystemDetails(31000001);

    expect(details).toMatchObject({
      shipKills: null,
      podKills: null,
      npcKills: null,
      shipJumps: null,
      snapshotAt: null,
    });
  });

  it('keeps a reported zero apart from an unreported null', async () => {
    // ESI listed the system with no jumps: that is a zero, not a gap.
    prisma.$queryRaw.mockResolvedValue([jitaRow({ ship_jumps: 0 })]);
    expect((await getMapSystemDetails(30000142))?.shipJumps).toBe(0);

    prisma.$queryRaw.mockReset();
    redis.get.mockResolvedValue(null);
    // ESI did not list it at all.
    prisma.$queryRaw.mockResolvedValue([jitaRow({ ship_jumps: null })]);
    expect((await getMapSystemDetails(30000142))?.shipJumps).toBeNull();
  });

  it('returns null for a system that does not exist', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    expect(await getMapSystemDetails(1)).toBeNull();
  });

  it('does not cache a miss', async () => {
    // A null would be indistinguishable from a cache miss on read, and an
    // unknown id is not worth a key.
    prisma.$queryRaw.mockResolvedValue([]);
    await getMapSystemDetails(1);
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it('serves a cached row without querying', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({ systemId: 30000142, name: 'Jita' }),
    );

    const details = await getMapSystemDetails(30000142);

    expect(details?.name).toBe('Jita');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('writes the cache with the live TTL', async () => {
    prisma.$queryRaw.mockResolvedValue([jitaRow()]);
    await getMapSystemDetails(30000142);

    expect(redis.setex).toHaveBeenCalledWith(
      'map:system:30000142',
      SYSTEM_DETAILS_CACHE_TTL_SECONDS,
      expect.any(String),
    );
    expect(SYSTEM_DETAILS_CACHE_TTL_SECONDS).toBe(300);
  });
});
