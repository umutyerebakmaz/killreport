import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@services/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import logger from '@services/logger';
import { characterTitleFields } from './character-achievement';

const base = {
  name: 'x',
  corporation_id: 1,
  birthday: '2010-01-01T00:00:00Z',
  bloodline_id: 1,
  race_id: 1,
  gender: 'male',
};

describe('characterTitleFields', () => {
  beforeEach(() => vi.mocked(logger.warn).mockClear());

  it('maps the new fields, corporation_title into title', () => {
    expect(
      characterTitleFields({
        ...base,
        corporation_title: 'CEO',
        character_title_id: '00851de7-b7ca-5136-871e-d07429563c06',
        achievement_score: 1234,
      }),
    ).toEqual({
      title: 'CEO',
      character_title_id: '00851de7-b7ca-5136-871e-d07429563c06',
      achievement_score: 1234,
    });
  });

  it('writes null for every key ESI left out', () => {
    expect(characterTitleFields(base)).toEqual({
      title: null,
      character_title_id: null,
      achievement_score: null,
    });
  });

  it('keeps a score of 0', () => {
    expect(
      characterTitleFields({ ...base, achievement_score: 0 }).achievement_score,
    ).toBe(0);
  });

  it('drops a score that does not fit an int column', () => {
    expect(
      characterTitleFields({ ...base, achievement_score: 2_147_483_648 })
        .achievement_score,
    ).toBeNull();
    expect(
      characterTitleFields({ ...base, achievement_score: -1 })
        .achievement_score,
    ).toBeNull();
    expect(
      characterTitleFields({ ...base, achievement_score: 1.5 })
        .achievement_score,
    ).toBeNull();
    expect(logger.warn).toHaveBeenCalledTimes(3);
  });
});
