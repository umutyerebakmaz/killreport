import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Where an incremental sync stops, read from the database rather than from a
 * column the publisher advances.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { $queryRaw: vi.fn() },
}));

vi.mock('@services/prisma-worker', () => ({ default: prismaMock }));

import { lastStoredKillmailId } from './killmail-cursor';

beforeEach(() => vi.clearAllMocks());

describe('lastStoredKillmailId', () => {
  it('returns the highest killmail id stored for a character', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ max: 128431979n }]);

    await expect(lastStoredKillmailId({ characterId: 95465499 })).resolves.toBe(
      128431979,
    );
  });

  it('converts the BIGINT Postgres returns, which JSON.stringify would throw on', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ max: 42n }]);

    const id = await lastStoredKillmailId({ characterId: 1 });

    expect(typeof id).toBe('number');
  });
});

describe('an entity with no killmails yet', () => {
  it('answers undefined, not 0', async () => {
    // 0 would be read by the list endpoints as "stop at killmail 0", which
    // truncates the very first sync of a new user to nothing.
    prismaMock.$queryRaw.mockResolvedValue([{ max: null }]);

    await expect(
      lastStoredKillmailId({ characterId: 1 }),
    ).resolves.toBeUndefined();
  });

  it('answers undefined when the query returns no row at all', async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);

    await expect(
      lastStoredKillmailId({ characterId: 1 }),
    ).resolves.toBeUndefined();
  });
});
