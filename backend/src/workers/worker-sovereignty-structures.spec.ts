import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * An empty ESI answer is a bad poll, not every IHub and TCU in New Eden
 * destroyed at once: the run writes nothing.
 */

const { getSovereigntyStructures, prisma, logger } = vi.hoisted(() => ({
  getSovereigntyStructures: vi.fn(),
  prisma: {
    sovereigntyStructure: { upsert: vi.fn(), updateMany: vi.fn() },
    $disconnect: vi.fn(),
  },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@services/sovereignty/sovereignty.service', () => ({
  SovereigntyService: { getSovereigntyStructures },
}));
vi.mock('@services/prisma-worker', () => ({ default: prisma }));
vi.mock('@services/logger', () => ({ default: logger }));

import { syncSovereigntyStructures } from './worker-sovereignty-structures';

describe('syncSovereigntyStructures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.sovereigntyStructure.updateMany.mockResolvedValue({ count: 0 });
  });

  it('skips destroyed-marking when ESI returns no structures', async () => {
    getSovereigntyStructures.mockResolvedValue([]);

    await syncSovereigntyStructures();

    expect(prisma.sovereigntyStructure.upsert).not.toHaveBeenCalled();
    expect(prisma.sovereigntyStructure.updateMany).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      '⚠️  ESI returned 0 sovereignty structures — skipping this run',
    );
  });

  it('still marks unlisted structures destroyed when ESI lists some', async () => {
    getSovereigntyStructures.mockResolvedValue([
      {
        structure_id: 1,
        solar_system_id: 30000001,
        structure_type_id: 32226,
        alliance_id: 99000001,
      },
    ]);

    await syncSovereigntyStructures();

    expect(prisma.sovereigntyStructure.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.sovereigntyStructure.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { destroyed_at: null, structure_id: { notIn: [BigInt(1)] } },
      }),
    );
  });
});
