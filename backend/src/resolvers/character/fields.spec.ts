import { describe, expect, it, vi } from 'vitest';

vi.mock('@services/prisma', () => ({ default: {}, prisma: {} }));

import { characterFields as typedFields } from './fields';

const characterFields = typedFields as Record<string, (...args: any[]) => any>;

const ctx = {
  loaders: {
    characterTitle: {
      load: vi.fn(async (id: string) =>
        id === '00851de7-b7ca-5136-871e-d07429563c06'
          ? 'Battlecruiser Smith'
          : null,
      ),
    },
  },
};

describe('characterFields achievement fields', () => {
  it('resolves the equipped title to its name', async () => {
    expect(
      await characterFields.characterTitle(
        { character_title_id: '00851de7-b7ca-5136-871e-d07429563c06' } as any,
        {},
        ctx as any,
        {} as any,
      ),
    ).toBe('Battlecruiser Smith');
  });

  it('returns null for a title the SDE import has not seen', async () => {
    expect(
      await characterFields.characterTitle(
        { character_title_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff' } as any,
        {},
        ctx as any,
        {} as any,
      ),
    ).toBeNull();
  });

  it('returns null without asking the loader when no title is equipped', async () => {
    ctx.loaders.characterTitle.load.mockClear();
    expect(
      await characterFields.characterTitle(
        { character_title_id: null } as any,
        {},
        ctx as any,
        {} as any,
      ),
    ).toBeNull();
    expect(ctx.loaders.characterTitle.load).not.toHaveBeenCalled();
  });

  it('maps achievement_score, keeping 0', () => {
    expect(
      characterFields.achievementScore(
        { achievement_score: 0 } as any,
        {},
        ctx as any,
        {} as any,
      ),
    ).toBe(0);
  });

  it('maps a missing achievement_score to null', () => {
    expect(
      characterFields.achievementScore({} as any, {}, ctx as any, {} as any),
    ).toBeNull();
  });
});
