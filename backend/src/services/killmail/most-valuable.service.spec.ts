import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The read half of killmail_filters. Every input is clamped before it reaches
 * the cache key, so a caller asking for 10,000 rows or a 5-year window must not
 * be able to open its own cache entry — or poison a legitimate one.
 */

const { prisma, redis, sqlFragment } = vi.hoisted(() => ({
  prisma: { $queryRaw: vi.fn() },
  redis: { get: vi.fn(), setex: vi.fn() },
  // Prisma.sql is a tagged template; the mock keeps the text so a test can say
  // which scope predicate was spliced into the query.
  sqlFragment: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    fragment: strings.join(' ? ').replace(/\s+/g, ' ').trim(),
    values,
  })),
}));

vi.mock('@services/prisma', () => ({ default: prisma }));
vi.mock('@services/redis', () => ({ default: redis, redis }));
vi.mock('@generated/prisma/client', () => ({ Prisma: { sql: sqlFragment } }));
vi.mock('@config/cache', () => ({ CACHE_TTL: { KILLMAIL_LIST: 300_000 } }));

import {
  CAPITAL_GROUP_IDS,
  NON_SHIP_GROUP_IDS,
  STRUCTURE_GROUP_IDS,
} from '@config/ship-groups';
import { MostValuableScope } from '@generated-types';

import { getMostValuableKillmails } from './most-valuable.service';

const NOW = new Date('2026-09-04T12:00:00.000Z');

function row(overrides: Record<string, unknown> = {}) {
  return {
    killmail_id: 130000001,
    killmail_time: new Date('2026-09-03T14:25:00.000Z'),
    solar_system_id: 30000142,
    total_value: 1_500_000_000,
    attacker_count: 12,
    ...overrides,
  };
}

/** The values spliced into the query, and the scope predicate among them. */
function queryValues() {
  const [, ...values] = prisma.$queryRaw.mock.calls[0] as [
    TemplateStringsArray,
    ...unknown[],
  ];
  return values;
}

function predicate() {
  const found = queryValues().find(
    (v): v is { fragment: string; values: unknown[] } =>
      typeof v === 'object' && v !== null && 'fragment' in v,
  );
  return found;
}

function cacheKey() {
  return redis.get.mock.calls[0][0] as string;
}

beforeEach(() => {
  // Only Date is frozen; nothing here waits on a timer.
  vi.setSystemTime(NOW);
  redis.get.mockResolvedValue(null);
  redis.setex.mockResolvedValue('OK');
  prisma.$queryRaw.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('caching', () => {
  it('serves a cache hit without touching the database', async () => {
    const cached = [{ id: '130000001', totalValue: 1 }];
    redis.get.mockResolvedValue(JSON.stringify(cached));

    await expect(
      getMostValuableKillmails(MostValuableScope.Ships),
    ).resolves.toEqual(cached);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it('keys on the scope, the window and the limit', async () => {
    await getMostValuableKillmails(MostValuableScope.Capitals, 30, 10);

    expect(cacheKey()).toBe('killmails:mostvaluable:CAPITALS:30:10');
  });

  it('names the defaults in the key rather than leaving a hole', async () => {
    await getMostValuableKillmails(MostValuableScope.Ships);

    expect(cacheKey()).toBe('killmails:mostvaluable:SHIPS:7:20');
  });

  it('treats a null window and limit as the defaults', async () => {
    await getMostValuableKillmails(MostValuableScope.Ships, null, null);

    expect(cacheKey()).toBe('killmails:mostvaluable:SHIPS:7:20');
  });

  it('gives two scopes separate entries', async () => {
    await getMostValuableKillmails(MostValuableScope.Ships, 7, 20);
    await getMostValuableKillmails(MostValuableScope.Solo, 7, 20);

    expect(redis.get.mock.calls.map(([key]) => key)).toEqual([
      'killmails:mostvaluable:SHIPS:7:20',
      'killmails:mostvaluable:SOLO:7:20',
    ]);
  });

  it('caches for the killmail list TTL, in seconds', async () => {
    await getMostValuableKillmails(MostValuableScope.Ships);

    expect(redis.setex).toHaveBeenCalledWith(
      'killmails:mostvaluable:SHIPS:7:20',
      300,
      expect.any(String),
    );
  });
});

describe('clamping the caller', () => {
  it('caps the limit at 50', async () => {
    await getMostValuableKillmails(MostValuableScope.Ships, 7, 10_000);

    expect(cacheKey()).toBe('killmails:mostvaluable:SHIPS:7:50');
    expect(queryValues()).toContain(50);
  });

  it('caps the window at 90 days', async () => {
    await getMostValuableKillmails(MostValuableScope.Ships, 3650, 20);

    expect(cacheKey()).toBe('killmails:mostvaluable:SHIPS:90:20');
  });

  it('raises a window below one day back to one', async () => {
    await getMostValuableKillmails(MostValuableScope.Ships, 0, 20);

    expect(cacheKey()).toBe('killmails:mostvaluable:SHIPS:1:20');
  });

  it('raises a negative window back to one day', async () => {
    await getMostValuableKillmails(MostValuableScope.Ships, -30, 20);

    expect(cacheKey()).toBe('killmails:mostvaluable:SHIPS:1:20');
  });

  it('cannot be made to open an entry outside the clamped range', async () => {
    await getMostValuableKillmails(MostValuableScope.Ships, 5000, 5000);
    await getMostValuableKillmails(MostValuableScope.Ships, 90, 50);

    const [first, second] = redis.get.mock.calls.map(([key]) => key);
    expect(first).toBe(second);
  });
});

describe('the window', () => {
  it('measures back from now', async () => {
    await getMostValuableKillmails(MostValuableScope.Ships, 7, 20);

    expect(queryValues()).toContainEqual(new Date('2026-08-28T12:00:00.000Z'));
  });

  it('moves with the requested day count', async () => {
    await getMostValuableKillmails(MostValuableScope.Ships, 1, 20);

    expect(queryValues()).toContainEqual(new Date('2026-09-03T12:00:00.000Z'));
  });
});

describe('scope predicates', () => {
  it('excludes pods and structures from SHIPS, and unresolved hulls with them', async () => {
    await getMostValuableKillmails(MostValuableScope.Ships);

    expect(predicate()?.fragment).toContain('victim_ship_group_id IS NOT NULL');
    expect(predicate()?.fragment).toContain('<> ALL(');
    expect(predicate()?.values).toEqual([NON_SHIP_GROUP_IDS]);
  });

  it('matches only the structure groups for STRUCTURES', async () => {
    await getMostValuableKillmails(MostValuableScope.Structures);

    expect(predicate()?.fragment).toContain('= ANY(');
    expect(predicate()?.values).toEqual([STRUCTURE_GROUP_IDS]);
  });

  it('matches only the capital groups for CAPITALS', async () => {
    await getMostValuableKillmails(MostValuableScope.Capitals);

    expect(predicate()?.values).toEqual([CAPITAL_GROUP_IDS]);
  });

  it('adds the single-attacker condition for SOLO', async () => {
    await getMostValuableKillmails(MostValuableScope.Solo);

    expect(predicate()?.fragment).toContain('attacker_count = 1');
    expect(predicate()?.values).toEqual([NON_SHIP_GROUP_IDS]);
  });
});

describe('the query', () => {
  const sql = () => {
    const [strings] = prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray];
    return strings.join(' ? ').replace(/\s+/g, ' ');
  };

  it('reads killmail_filters, not the raw killmails table', async () => {
    await getMostValuableKillmails(MostValuableScope.Ships);

    expect(sql()).toContain('FROM killmail_filters');
    expect(sql()).not.toContain('JOIN');
  });

  it('orders by value and keeps unvalued rows out', async () => {
    await getMostValuableKillmails(MostValuableScope.Ships);

    expect(sql()).toContain('total_value IS NOT NULL');
    expect(sql()).toContain('ORDER BY total_value DESC');
  });
});

describe('the rows', () => {
  it('returns the id as a string and the time as ISO', async () => {
    prisma.$queryRaw.mockResolvedValue([row()]);

    const [item] = await getMostValuableKillmails(MostValuableScope.Ships);

    expect(item).toEqual({
      id: '130000001',
      killmailTime: '2026-09-03T14:25:00.000Z',
      totalValue: 1_500_000_000,
      solarSystemId: 30000142,
      attackerCount: 12,
    });
  });

  it('reports a missing attacker count as zero, not null', async () => {
    prisma.$queryRaw.mockResolvedValue([row({ attacker_count: null })]);

    const [item] = await getMostValuableKillmails(MostValuableScope.Ships);

    expect(item.attackerCount).toBe(0);
  });

  it('passes a null solar system through rather than dropping the row', async () => {
    prisma.$queryRaw.mockResolvedValue([row({ solar_system_id: null })]);

    const items = await getMostValuableKillmails(MostValuableScope.Ships);

    expect(items).toHaveLength(1);
    expect(items[0].solarSystemId).toBeNull();
  });

  it('caches exactly what it returns', async () => {
    prisma.$queryRaw.mockResolvedValue([row(), row({ killmail_id: 2 })]);

    const items = await getMostValuableKillmails(MostValuableScope.Ships);
    const [, , payload] = redis.setex.mock.calls[0] as [string, number, string];

    expect(JSON.parse(payload)).toEqual(items);
  });

  it('caches an empty result rather than re-querying for it', async () => {
    await expect(
      getMostValuableKillmails(MostValuableScope.Ships),
    ).resolves.toEqual([]);
    expect(redis.setex).toHaveBeenCalledWith(expect.any(String), 300, '[]');
  });
});
