import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The killmail_filters WHERE builder. Only the faction branch is pinned
 * here: it is the one this file gained for the faction pages, and it must
 * match a killmail from either side, like the alliance branch.
 */

const { prisma } = vi.hoisted(() => ({
  prisma: { $queryRawUnsafe: vi.fn(), type: { findMany: vi.fn() } },
}));

vi.mock('@services/prisma', () => ({ default: prisma }));

import { filtersMaterialized } from './filters-materialized';

beforeEach(() => {
  prisma.$queryRawUnsafe.mockResolvedValue([]);
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
