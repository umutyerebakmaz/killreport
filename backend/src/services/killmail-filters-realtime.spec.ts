import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The write half of killmail_filters — the table every leaderboard and the
 * most-valuable list read from. It runs inside the killmail save path and
 * deliberately swallows its own errors, so nothing downstream reports a row
 * that never landed. That contract, and the array cleaning that decides what a
 * top-attackers lookup will match, are what these tests hold in place.
 */

const { prismaWorker, logger } = vi.hoisted(() => ({
  prismaWorker: { $executeRaw: vi.fn() },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@services/prisma-worker', () => ({ default: prismaWorker }));
vi.mock('@services/logger', () => ({ default: logger }));

import { insertKillmailFilter } from './killmail-filters-realtime';

const BASE = {
  killmail_id: 130000001n,
  killmail_time: new Date('2026-09-03T14:25:00.000Z'),
  solar_system_id: 30000142,
  attacker_count: 3,
  victim_ship_type_id: 587,
  victim_character_id: 95465499,
  victim_corporation_id: 98000001,
  victim_alliance_id: 99005338,
  attacker_ship_type_ids: [] as (number | null)[],
  attacker_character_ids: [] as (number | null)[],
  attacker_corporation_ids: [] as (number | null)[],
  attacker_alliance_ids: [] as (number | null)[],
};

const insert = (overrides: Partial<typeof BASE> = {}) =>
  insertKillmailFilter({ ...BASE, ...overrides });

/** The statement text of the single $executeRaw call, whitespace collapsed. */
function sql() {
  const [strings] = prismaWorker.$executeRaw.mock.calls[0] as [
    TemplateStringsArray,
  ];
  return strings.join(' ? ').replace(/\s+/g, ' ');
}

/** The values bound into that statement, in order. */
function values() {
  const [, ...bound] = prismaWorker.$executeRaw.mock.calls[0] as [
    TemplateStringsArray,
    ...unknown[],
  ];
  return bound;
}

/** The four attacker arrays, which are the last four bound values. */
function arrays() {
  const bound = values();
  const [ships, characters, corporations, alliances] = bound.slice(-4) as [
    number[],
    number[],
    number[],
    number[],
  ];
  return { ships, characters, corporations, alliances };
}

beforeEach(() => {
  prismaWorker.$executeRaw.mockResolvedValue(1);
});

describe('the attacker arrays', () => {
  it('drops the nulls an unresolved attacker leaves behind', async () => {
    await insert({
      attacker_ship_type_ids: [587, null, 588],
      attacker_character_ids: [null, null],
      attacker_corporation_ids: [98000001, null],
      attacker_alliance_ids: [null, 99005338],
    });

    expect(arrays()).toEqual({
      ships: [587, 588],
      characters: [],
      corporations: [98000001],
      alliances: [99005338],
    });
  });

  it('counts an attacker once however many times it appears', async () => {
    await insert({
      attacker_character_ids: [95465499, 95465499, 95465499],
      attacker_corporation_ids: [98000001, 98000001, 98000002],
    });

    expect(arrays().characters).toEqual([95465499]);
    expect(arrays().corporations).toEqual([98000001, 98000002]);
  });

  it('keeps the order the attackers arrived in', async () => {
    await insert({ attacker_ship_type_ids: [17738, 587, 17738, 11567] });

    expect(arrays().ships).toEqual([17738, 587, 11567]);
  });

  it('sends an empty array rather than nothing for a solo NPC kill', async () => {
    await insert({
      attacker_ship_type_ids: [null],
      attacker_character_ids: [null],
      attacker_corporation_ids: [null],
      attacker_alliance_ids: [null],
    });

    expect(arrays()).toEqual({
      ships: [],
      characters: [],
      corporations: [],
      alliances: [],
    });
  });
});

describe('the statement', () => {
  it('binds every caller-supplied column rather than interpolating it', async () => {
    await insert({ attacker_ship_type_ids: [587] });

    expect(values().slice(0, 8)).toEqual([
      130000001n,
      BASE.killmail_time,
      30000142,
      3,
      587,
      95465499,
      98000001,
      99005338,
    ]);
    expect(sql()).not.toContain('130000001');
    expect(sql()).not.toContain('95465499');
  });

  it('runs exactly one statement per killmail', async () => {
    await insert();

    expect(prismaWorker.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('derives location, ship group and value from joins, not from the caller', async () => {
    await insert();

    expect(sql()).toContain('LEFT JOIN solar_systems');
    expect(sql()).toContain('LEFT JOIN constellations');
    expect(sql()).toContain('LEFT JOIN types');
    expect(sql()).toContain('LEFT JOIN killmails');
    // Twelve bound values, and none of them a region or constellation: the
    // callers never had those, which is how they stayed NULL for five months.
    expect(values()).toHaveLength(12);
  });

  it('heals a row only while its derived columns are still NULL', async () => {
    await insert();

    expect(sql()).toContain('ON CONFLICT (killmail_id) DO UPDATE SET');
    for (const column of [
      'region_id',
      'security_status',
      'total_value',
      'victim_ship_group_id',
    ]) {
      expect(sql()).toContain(`killmail_filters.${column}`);
      expect(sql()).toContain(`${column} = EXCLUDED.${column}`);
    }
  });

  it('never rewrites the attacker arrays on conflict', async () => {
    await insert();
    const onConflict = sql().split('ON CONFLICT')[1];

    expect(onConflict).not.toContain('attacker_ship_type_ids');
    expect(onConflict).not.toContain('attacker_character_ids');
    expect(onConflict).not.toContain('attacker_corporation_ids');
    expect(onConflict).not.toContain('attacker_alliance_ids');
    expect(onConflict).not.toContain('attacker_count');
  });
});

describe('failure handling', () => {
  it('swallows a database error instead of failing the killmail save', async () => {
    prismaWorker.$executeRaw.mockRejectedValue(new Error('deadlock detected'));

    await expect(insert()).resolves.toBeUndefined();
  });

  it('logs the error with the killmail it belonged to', async () => {
    const error = new Error('deadlock detected');
    prismaWorker.$executeRaw.mockRejectedValue(error);

    await insert();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('130000001'),
      error,
    );
  });

  it('logs a debug line on the way through', async () => {
    await insert();

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('130000001'),
    );
    expect(logger.error).not.toHaveBeenCalled();
  });
});
