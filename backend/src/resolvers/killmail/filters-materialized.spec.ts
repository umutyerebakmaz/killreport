import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The killmail_filters WHERE builder. Only the faction branch is pinned
 * here: it is the one this file gained for the faction pages, and it must
 * match a killmail from either side, like the alliance branch.
 */

const { prisma } = vi.hoisted(() => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    type: { findMany: vi.fn() },
    itemGroup: { findMany: vi.fn() },
  },
}));

vi.mock('@services/prisma', () => ({ default: prisma }));

import { filtersMaterialized } from './filters-materialized';

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$queryRawUnsafe.mockResolvedValue([]);
  prisma.type.findMany.mockResolvedValue([]);
  prisma.itemGroup.findMany.mockResolvedValue([]);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

function call() {
  const [query, ...params] = prisma.$queryRawUnsafe.mock.calls[0] as [
    string,
    ...unknown[],
  ];
  return { query: query.replace(/\s+/g, ' '), params };
}

describe('filtersMaterialized factionId', () => {
  it('matches the faction as victim or among the attackers', async () => {
    await filtersMaterialized({ factionId: 500003 });

    expect(call().query).toContain(
      '(victim_faction_id = $1 OR $1 = ANY(attacker_faction_ids))',
    );
    expect(call().params).toEqual([500003]);
  });

  it('numbers its parameter after the ones before it', async () => {
    await filtersMaterialized({ allianceId: 99005338, factionId: 500003 });

    expect(call().query).toContain('victim_alliance_id = $1');
    expect(call().query).toContain('victim_faction_id = $2');
    expect(call().params).toEqual([99005338, 500003]);
  });

  it('adds nothing when factionId is absent', async () => {
    await filtersMaterialized({ allianceId: 99005338 });

    expect(call().query).not.toContain('faction');
  });
});

describe('filtersMaterialized shipTier', () => {
  // Ship groups, then the ship types of the tier's meta groups in them.
  const shipGroups = [{ id: 27 }, { id: 485 }];
  const typesOf = (...ids: number[]) => ids.map((id) => ({ id }));

  it("looks up the tier's meta groups among ship types only", async () => {
    prisma.itemGroup.findMany.mockResolvedValue(shipGroups);
    prisma.type.findMany.mockResolvedValue(typesOf(73793, 17636));

    await filtersMaterialized({ shipTier: 'FACTION' as never });

    expect(prisma.itemGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { category_id: 6 } }),
    );
    expect(prisma.type.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { meta_group_id: { in: [3, 4] }, group_id: { in: [27, 485] } },
      }),
    );
  });

  it('maps Tech2 to meta group 2 and Tech3 to 14', async () => {
    prisma.itemGroup.findMany.mockResolvedValue(shipGroups);

    await filtersMaterialized({ shipTier: 'TECH2' as never });
    await filtersMaterialized({ shipTier: 'TECH3' as never });

    const metaGroups = prisma.type.findMany.mock.calls.map(
      ([arg]) =>
        (arg as { where: { meta_group_id: { in: number[] } } }).where
          .meta_group_id.in,
    );
    expect(metaGroups).toEqual([[2], [14]]);
  });

  it('matches the tier on the victim or the attackers by default', async () => {
    prisma.itemGroup.findMany.mockResolvedValue(shipGroups);
    prisma.type.findMany.mockResolvedValue(typesOf(73793, 17636));

    await filtersMaterialized({ shipTier: 'FACTION' as never });

    expect(call().query).toContain(
      '(victim_ship_type_id = ANY($1::int[]) OR attacker_ship_type_ids && $1::int[])',
    );
    expect(call().params).toEqual([[73793, 17636]]);
  });

  it("keeps only the chosen ship's types that are also in the tier", async () => {
    prisma.itemGroup.findMany.mockResolvedValue(shipGroups);
    // First findMany: the Battleship group's types. Second: the tier's.
    prisma.type.findMany
      .mockResolvedValueOnce(typesOf(638, 17636, 17738))
      .mockResolvedValueOnce(typesOf(73793, 17636, 17738));

    await filtersMaterialized({
      shipGroupIds: [27],
      shipTier: 'FACTION' as never,
      victim: true,
    });

    expect(call().query).toContain('victim_ship_type_id = ANY($1::int[])');
    expect(call().params).toEqual([[17636, 17738]]);
  });

  it('matches nothing when the ship and the tier have no type in common', async () => {
    prisma.itemGroup.findMany.mockResolvedValue(shipGroups);
    prisma.type.findMany
      .mockResolvedValueOnce(typesOf(587, 603))
      .mockResolvedValueOnce(typesOf(29986));

    await filtersMaterialized({
      shipGroupIds: [25],
      shipTier: 'TECH3' as never,
    });

    // An empty list still goes in, so no row matches — without the tier the
    // builder would drop an empty list and return every killmail.
    expect(call().params).toEqual([[]]);
  });
});
