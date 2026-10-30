import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@config/config', () => ({ config: {} }));

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  character: { findUnique: vi.fn() },
  corporation: { findUnique: vi.fn() },
  alliance: { findUnique: vi.fn() },
  trackedEntity: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
}));
vi.mock('@services/prisma', () => ({ default: prismaMock }));

import { Prisma } from '@generated/prisma/client';
import {
  getTrackerRefs,
  TRACKER_LIMIT,
  trackEntity,
  TrackerError,
  untrackEntity,
} from './tracker.service';

const CHARACTER_ID = 365974960;
const USER = { id: 7, character_id: CHARACTER_ID };

beforeEach(() => {
  vi.resetAllMocks();
  prismaMock.user.findUnique.mockResolvedValue(USER);
  prismaMock.trackedEntity.findMany.mockResolvedValue([]);
  prismaMock.trackedEntity.findUnique.mockResolvedValue(null);
  prismaMock.trackedEntity.count.mockResolvedValue(0);
  prismaMock.character.findUnique.mockResolvedValue({
    id: CHARACTER_ID,
    corporation_id: 98000001,
    alliance_id: 99000001,
  });
  prismaMock.corporation.findUnique.mockResolvedValue({ id: 1 });
  prismaMock.alliance.findUnique.mockResolvedValue({ id: 1 });
});

describe('getTrackerRefs', () => {
  it('returns the corporation and alliance as automatic, manual ones as not', async () => {
    prismaMock.trackedEntity.findMany.mockResolvedValue([
      { entity_type: 'CHARACTER', entity_id: 123 },
    ]);
    const refs = await getTrackerRefs(CHARACTER_ID);
    expect(refs).toEqual([
      { type: 'CORPORATION', id: 98000001, automatic: true },
      { type: 'ALLIANCE', id: 99000001, automatic: true },
      { type: 'CHARACTER', id: 123, automatic: false },
    ]);
  });

  it('skips the alliance when alliance_id is null', async () => {
    prismaMock.character.findUnique.mockResolvedValue({
      id: CHARACTER_ID,
      corporation_id: 98000001,
      alliance_id: null,
    });
    const refs = await getTrackerRefs(CHARACTER_ID);
    expect(refs).toEqual([
      { type: 'CORPORATION', id: 98000001, automatic: true },
    ]);
  });

  it('lists an own corporation that was also added manually once, as automatic', async () => {
    prismaMock.trackedEntity.findMany.mockResolvedValue([
      { entity_type: 'CORPORATION', entity_id: 98000001 },
    ]);
    const refs = await getTrackerRefs(CHARACTER_ID);
    expect(
      refs.filter((r) => r.type === 'CORPORATION' && r.id === 98000001),
    ).toEqual([{ type: 'CORPORATION', id: 98000001, automatic: true }]);
    expect(refs).toHaveLength(2);
  });

  it('returns only manual entries when there is no character row', async () => {
    prismaMock.character.findUnique.mockResolvedValue(null);
    prismaMock.trackedEntity.findMany.mockResolvedValue([
      { entity_type: 'ALLIANCE', entity_id: 5 },
    ]);
    const refs = await getTrackerRefs(CHARACTER_ID);
    expect(refs).toEqual([{ type: 'ALLIANCE', id: 5, automatic: false }]);
  });
});

describe('trackEntity', () => {
  it('rejects tracking yourself with SELF', async () => {
    await expect(
      trackEntity(CHARACTER_ID, 'CHARACTER', CHARACTER_ID),
    ).rejects.toMatchObject({ code: 'SELF' });
  });

  it('rejects an unknown user with USER_NOT_FOUND', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const err = await trackEntity(CHARACTER_ID, 'CHARACTER', 1).catch((e) => e);
    expect(err).toBeInstanceOf(TrackerError);
    expect(err.code).toBe('USER_NOT_FOUND');
  });

  it('rejects an id missing from its table with NOT_FOUND', async () => {
    prismaMock.corporation.findUnique.mockResolvedValue(null);
    await expect(
      trackEntity(CHARACTER_ID, 'CORPORATION', 42),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(prismaMock.trackedEntity.create).not.toHaveBeenCalled();
  });

  it('rejects with LIMIT at the manual limit', async () => {
    prismaMock.trackedEntity.count.mockResolvedValue(TRACKER_LIMIT);
    prismaMock.character.findUnique.mockResolvedValue({ id: 9 });
    await expect(
      trackEntity(CHARACTER_ID, 'CHARACTER', 9),
    ).rejects.toMatchObject({ code: 'LIMIT' });
    expect(prismaMock.trackedEntity.create).not.toHaveBeenCalled();
  });

  it('adds one below the limit', async () => {
    prismaMock.trackedEntity.count.mockResolvedValue(TRACKER_LIMIT - 1);
    prismaMock.character.findUnique.mockResolvedValue({ id: 9 });
    await trackEntity(CHARACTER_ID, 'CHARACTER', 9);
    expect(prismaMock.trackedEntity.create).toHaveBeenCalledWith({
      data: { user_id: 7, entity_type: 'CHARACTER', entity_id: 9 },
    });
  });

  it('does nothing when already tracked', async () => {
    prismaMock.trackedEntity.findUnique.mockResolvedValue({ id: 1 });
    prismaMock.trackedEntity.count.mockResolvedValue(TRACKER_LIMIT);
    await expect(
      trackEntity(CHARACTER_ID, 'ALLIANCE', 5),
    ).resolves.toBeUndefined();
    expect(prismaMock.trackedEntity.create).not.toHaveBeenCalled();
  });
});

describe('trackEntity concurrent duplicate', () => {
  it('treats a P2002 on create as a silent no-op', async () => {
    prismaMock.trackedEntity.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      trackEntity(CHARACTER_ID, 'ALLIANCE', 5),
    ).resolves.toBeUndefined();
  });

  it('rethrows any other create error', async () => {
    prismaMock.trackedEntity.create.mockRejectedValue(new Error('boom'));
    await expect(trackEntity(CHARACTER_ID, 'ALLIANCE', 5)).rejects.toThrow(
      'boom',
    );
  });
});

describe('untrackEntity', () => {
  it('deletes by user, type and id', async () => {
    await untrackEntity(CHARACTER_ID, 'ALLIANCE', 5);
    expect(prismaMock.trackedEntity.deleteMany).toHaveBeenCalledWith({
      where: { user_id: 7, entity_type: 'ALLIANCE', entity_id: 5 },
    });
  });
});
