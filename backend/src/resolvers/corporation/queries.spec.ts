import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The corporations list, as the faction Members tab calls it. */

const { prisma } = vi.hoisted(() => ({
  prisma: { corporation: { findMany: vi.fn(), count: vi.fn() } },
}));

vi.mock('@services/prisma', () => ({ default: prisma }));
vi.mock('@services/redis', () => ({ default: {} }));

import { corporationQueries } from './queries';

beforeEach(() => {
  prisma.corporation.findMany.mockResolvedValue([]);
  prisma.corporation.count.mockResolvedValue(0);
});

const corporations = corporationQueries.corporations as (
  parent: unknown,
  args: unknown,
) => Promise<unknown>;

describe('corporations factionId filter', () => {
  it('filters on faction_id and still drops NPC corporations', async () => {
    await corporations({}, { filter: { factionId: 500003 } });

    const { where } = prisma.corporation.findMany.mock.calls[0][0];
    expect(where).toMatchObject({ faction_id: 500003, id: { gte: 2000000 } });
    expect(prisma.corporation.count).toHaveBeenCalledWith({ where });
  });

  it('leaves faction_id out when no factionId is given', async () => {
    await corporations({}, { filter: {} });

    const { where } = prisma.corporation.findMany.mock.calls[0][0];
    expect(where).not.toHaveProperty('faction_id');
  });
});
