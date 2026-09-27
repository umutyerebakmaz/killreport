import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The factions list feeds the /factions grid. ESI's placeholder faction
 * 500021 ("Unknown") is a row in the table but not a faction anyone can
 * open a page for, so the list leaves it out.
 */

const { prisma } = vi.hoisted(() => ({
  prisma: { faction: { findMany: vi.fn(), findUnique: vi.fn() } },
}));

vi.mock('@services/prisma', () => ({ default: prisma }));

import { factionQueries } from './queries';

beforeEach(() => {
  prisma.faction.findMany.mockResolvedValue([]);
});

const factions = factionQueries.factions as () => Promise<unknown>;

describe('factions', () => {
  it('leaves out the Unknown placeholder faction', async () => {
    await factions();

    expect(prisma.faction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { not: 500021 } } }),
    );
  });

  it('orders by name', async () => {
    await factions();

    expect(prisma.faction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'asc' } }),
    );
  });
});
