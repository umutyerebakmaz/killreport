import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A feed with no owned system writes nothing, and the change log, upserts and
 * deletes commit together before any alert goes out.
 */

const { getSovereigntyMap, prisma, tx, publish, logger } = vi.hoisted(() => {
  const tx = {
    territoryChange: { createMany: vi.fn() },
    sovereigntyMapCurrent: { deleteMany: vi.fn() },
    $executeRaw: vi.fn(),
  };
  return {
    getSovereigntyMap: vi.fn(),
    tx,
    prisma: {
      sovereigntyMapCurrent: { findMany: vi.fn(), deleteMany: vi.fn() },
      territoryChange: { createMany: vi.fn() },
      $executeRaw: vi.fn(),
      $transaction: vi.fn(),
      $disconnect: vi.fn(),
    },
    publish: vi.fn(),
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

vi.mock('@services/sovereignty/sovereignty.service', () => ({
  SovereigntyService: { getSovereigntyMap },
}));
vi.mock('@services/prisma-worker', () => ({ default: prisma }));
vi.mock('@services/logger', () => ({ default: logger }));
vi.mock('@services/pubsub', () => ({ pubsub: { publish } }));
vi.mock('@services/sovereignty/alert-builder', () => ({
  buildSovereigntyAlert: vi.fn(async (_c, e) => ({ type: e.type })),
}));

import { syncSovereigntyMap } from './worker-sovereignty-map';

const owned = (system_id: number, alliance_id: number) => ({
  system_id,
  alliance_id,
  corporation_id: 1000 + alliance_id,
});
const stored = (solar_system_id: number, alliance_id: number) => ({
  solar_system_id,
  alliance_id,
  corporation_id: 1000 + alliance_id,
  faction_id: null,
});

describe('syncSovereigntyMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn) => fn(tx));
  });

  it('writes nothing when ESI returns no owned systems', async () => {
    prisma.sovereigntyMapCurrent.findMany.mockResolvedValue([stored(1, 1)]);
    for (const map of [[], [{ system_id: 1 }]]) {
      getSovereigntyMap.mockResolvedValue(map);
      await syncSovereigntyMap();
    }

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.territoryChange.createMany).not.toHaveBeenCalled();
    expect(tx.sovereigntyMapCurrent.deleteMany).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      '⚠️  ESI returned no owned systems — skipping this run',
    );
  });

  it('writes changes, upserts and deletes in one transaction', async () => {
    prisma.sovereigntyMapCurrent.findMany.mockResolvedValue([
      stored(1, 1),
      stored(2, 2),
    ]);
    getSovereigntyMap.mockResolvedValue([owned(1, 2)]);

    await syncSovereigntyMap();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.territoryChange.createMany).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.sovereigntyMapCurrent.deleteMany).toHaveBeenCalledWith({
      where: { solar_system_id: { in: [2] } },
    });
    expect(prisma.territoryChange.createMany).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.sovereigntyMapCurrent.deleteMany).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('publishes alerts only after the transaction commits', async () => {
    prisma.sovereigntyMapCurrent.findMany.mockResolvedValue([stored(1, 1)]);
    getSovereigntyMap.mockResolvedValue([owned(1, 2)]);
    prisma.$transaction.mockRejectedValue(new Error('rolled back'));

    await expect(syncSovereigntyMap()).rejects.toThrow('rolled back');
    expect(publish).not.toHaveBeenCalled();
  });
});
