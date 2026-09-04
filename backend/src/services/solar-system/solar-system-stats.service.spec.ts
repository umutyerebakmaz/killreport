import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The fourth read service, and the odd one out: a class of static methods
 * rather than the plain functions the alliance/corporation/character trio
 * exports. The shape it shares with them is what these tests pin down —
 * Redis get, $queryRaw, Redis setex — plus the BigInt conversion, which is
 * the one thing that would throw at runtime rather than return a wrong number.
 */

const { prisma, redis } = vi.hoisted(() => ({
  prisma: { $queryRaw: vi.fn() },
  redis: { get: vi.fn(), setex: vi.fn() },
}));

vi.mock('@services/prisma', () => ({ default: prisma }));
vi.mock('@services/redis', () => ({ default: redis, redis }));

import { SolarSystemStatsService } from './solar-system-stats.service';

/** A totals row as PostgreSQL returns it: every ::BIGINT column a JS BigInt. */
function totalsRow(overrides: Record<string, unknown> = {}) {
  return {
    total_kills: 42n,
    total_isk: 1234.5,
    kills_24h: 3n,
    kills_7d: 12n,
    isk_7d: 678.9,
    last_kill_time: new Date('2026-09-03T14:25:00.000Z'),
    ...overrides,
  };
}

/** The values spliced into the tagged template of the nth $queryRaw call. */
function queryValues(call: number) {
  const [, ...values] = prisma.$queryRaw.mock.calls[call] as [
    TemplateStringsArray,
    ...unknown[],
  ];
  return values;
}

function querySql(call: number) {
  const [strings] = prisma.$queryRaw.mock.calls[call] as [TemplateStringsArray];
  return strings.join(' ? ').replace(/\s+/g, ' ');
}

beforeEach(() => {
  redis.get.mockResolvedValue(null);
  redis.setex.mockResolvedValue('OK');
  prisma.$queryRaw.mockResolvedValue([]);
});

describe('SolarSystemStatsService.getStats', () => {
  it('serves a cache hit without touching the database', async () => {
    const cached = { systemId: 30000142, totalKills: 7 };
    redis.get.mockResolvedValue(JSON.stringify(cached));

    await expect(SolarSystemStatsService.getStats(30000142)).resolves.toEqual(
      cached,
    );
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it('keys the cache on the system id', async () => {
    await SolarSystemStatsService.getStats(30000142);

    expect(redis.get).toHaveBeenCalledWith('solarSystem:stats:30000142');
    expect(redis.setex).toHaveBeenCalledWith(
      'solarSystem:stats:30000142',
      300,
      expect.any(String),
    );
  });

  it('writes a different key for a different system', async () => {
    await SolarSystemStatsService.getStats(30002187);

    expect(redis.get).toHaveBeenCalledWith('solarSystem:stats:30002187');
  });

  it('binds the system id into both queries rather than interpolating it', async () => {
    await SolarSystemStatsService.getStats(30000142);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(queryValues(0)).toEqual([30000142]);
    expect(queryValues(1)).toEqual([30000142]);
    expect(querySql(0)).not.toContain('30000142');
    expect(querySql(1)).not.toContain('30000142');
  });

  it('reads killmails, not the aggregate tables', async () => {
    await SolarSystemStatsService.getStats(30000142);

    expect(querySql(0)).toContain('FROM killmails');
    expect(querySql(1)).toContain('FROM killmails');
  });

  it('converts every BigInt count to a number', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([totalsRow()])
      .mockResolvedValueOnce([{ hour: 18, kill_count: 9n }]);

    const stats = await SolarSystemStatsService.getStats(30000142);

    expect(stats).toEqual({
      systemId: 30000142,
      totalKills: 42,
      totalIskDestroyed: 1234.5,
      kills24h: 3,
      kills7d: 12,
      iskDestroyed7d: 678.9,
      lastKillTime: '2026-09-03T14:25:00.000Z',
      busiestHourUtc: 18,
    });
  });

  it('caches a payload JSON.stringify can serialise', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([totalsRow()])
      .mockResolvedValueOnce([{ hour: 18, kill_count: 9n }]);

    const stats = await SolarSystemStatsService.getStats(30000142);
    const [, , payload] = redis.setex.mock.calls[0] as [string, number, string];

    expect(JSON.parse(payload)).toEqual(stats);
  });

  it('returns zeros for a system with no killmails', async () => {
    const stats = await SolarSystemStatsService.getStats(30000142);

    expect(stats).toEqual({
      systemId: 30000142,
      totalKills: 0,
      totalIskDestroyed: 0,
      kills24h: 0,
      kills7d: 0,
      iskDestroyed7d: 0,
      lastKillTime: null,
      busiestHourUtc: null,
    });
  });

  it('reports no last kill time when the column is null', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([totalsRow({ last_kill_time: null })])
      .mockResolvedValueOnce([]);

    const stats = await SolarSystemStatsService.getStats(30000142);

    expect(stats.lastKillTime).toBeNull();
  });

  it('reports no busiest hour when the last 7 days are empty', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([totalsRow()])
      .mockResolvedValueOnce([]);

    const stats = await SolarSystemStatsService.getStats(30000142);

    expect(stats.busiestHourUtc).toBeNull();
    expect(stats.totalKills).toBe(42);
  });

  it('keeps hour 0 rather than treating it as absent', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([totalsRow()])
      .mockResolvedValueOnce([{ hour: 0, kill_count: 5n }]);

    const stats = await SolarSystemStatsService.getStats(30000142);

    expect(stats.busiestHourUtc).toBe(0);
  });

  it('breaks a tie on the lower hour, in the query', async () => {
    await SolarSystemStatsService.getStats(30000142);

    expect(querySql(1)).toContain('ORDER BY kill_count DESC, hour ASC');
    expect(querySql(1)).toContain('LIMIT 1');
  });

  it('reads the busiest hour in UTC', async () => {
    await SolarSystemStatsService.getStats(30000142);

    expect(querySql(1)).toContain("AT TIME ZONE 'UTC'");
  });
});
