import { describe, expect, it, vi } from 'vitest';

/**
 * The killmails page groups kills by the day they happened, not the day this
 * database saved them. The two differ whenever a killmail arrives late: the
 * R2Z2 stream catching up after downtime, a character's zKillboard history,
 * killmail_refs retries. A 25 November kill saved on 28 November must count
 * on the 25th. Every branch of killmailsDateCounts is pinned here, because
 * each one builds its grouping differently.
 */

const { prisma, redis, filtersMaterialized } = vi.hoisted(() => ({
  prisma: {
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    killmail: { findMany: vi.fn() },
  },
  redis: { get: vi.fn(), setex: vi.fn() },
  filtersMaterialized: vi.fn(),
}));

vi.mock('@services/prisma', () => ({ default: prisma }));
vi.mock('@services/redis', () => ({ default: redis, redis }));
vi.mock('./filters-materialized', () => ({ filtersMaterialized }));

import { killmailQueries } from './queries';

function dateCounts(filter?: unknown) {
  const resolver = killmailQueries.killmailsDateCounts as unknown as (
    parent: unknown,
    args: unknown,
    context: unknown,
    info: unknown,
  ) => Promise<{ date: string; count: number }[]>;
  return resolver(undefined, { filter }, {}, {});
}

/** The SQL text of the first $queryRaw call, whitespace collapsed. */
function rawSql() {
  const [strings] = prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray];
  return strings.join(' ? ').replace(/\s+/g, ' ');
}

/** The SQL text of the last $queryRawUnsafe call, whitespace collapsed. */
function unsafeSql() {
  const calls = prisma.$queryRawUnsafe.mock.calls;
  return (calls[calls.length - 1][0] as string).replace(/\s+/g, ' ');
}

describe('killmailsDateCounts groups by killmail_time', () => {
  it('without a filter, groups in SQL by DATE(killmail_time)', async () => {
    redis.get.mockResolvedValue(null);
    // DATE() comes back as UTC midnight of the kill's day.
    prisma.$queryRaw.mockResolvedValue([
      { date: new Date('2026-11-28T00:00:00Z'), count: 14407n },
      { date: new Date('2026-11-25T00:00:00Z'), count: 36n },
    ]);

    const result = await dateCounts();

    const sql = rawSql();
    expect(sql).toContain('DATE(killmail_time)');
    expect(sql).toContain('GROUP BY DATE(killmail_time)');
    expect(sql).not.toContain('created_at');
    expect(result).toEqual([
      { date: '2026-11-28', count: 14407 },
      { date: '2026-11-25', count: 36 },
    ]);
  });

  it('with an entity filter, groups the matching ids by DATE(killmail_time)', async () => {
    redis.get.mockResolvedValue(null);
    filtersMaterialized.mockResolvedValue([1, 2]);
    prisma.$queryRawUnsafe.mockResolvedValue([
      { date: new Date('2026-11-25T00:00:00Z'), count: 2n },
    ]);

    const result = await dateCounts({ characterId: 2124006812 });

    const sql = unsafeSql();
    expect(sql).toContain('GROUP BY DATE(killmail_time)');
    expect(sql).not.toContain('created_at');
    expect(result).toEqual([{ date: '2026-11-25', count: 2 }]);
  });

  it('with a value-only filter, counts each kill on its UTC killmail_time day', async () => {
    redis.get.mockResolvedValue(null);
    prisma.killmail.findMany.mockResolvedValue([
      // 23:59 UTC on the 25th is the 25th, whatever the server's time zone.
      { killmail_time: new Date('2026-11-25T23:59:59Z') },
      { killmail_time: new Date('2026-11-25T00:00:00Z') },
      { killmail_time: new Date('2026-11-28T02:00:00Z') },
    ]);

    const result = await dateCounts({ minValue: 1_000_000 });

    const query = prisma.killmail.findMany.mock.calls[0][0];
    expect(query.select).toEqual({ killmail_time: true });
    expect(result).toEqual([
      { date: '2026-11-28', count: 1 },
      { date: '2026-11-25', count: 2 },
    ]);
  });
});
