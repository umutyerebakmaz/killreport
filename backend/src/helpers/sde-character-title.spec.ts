import { describe, expect, it } from 'vitest';

import { parseCharacterTitleLine } from './sde-character-title';

describe('parseCharacterTitleLine', () => {
  it('reads the uuid and the English name', () => {
    const line = JSON.stringify({
      _key: '00851de7-b7ca-5136-871e-d07429563c06',
      name: { de: 'Schlachtkreuzerschmied', en: 'Battlecruiser Smith' },
    });
    expect(parseCharacterTitleLine(line)).toEqual({
      id: '00851de7-b7ca-5136-871e-d07429563c06',
      name: 'Battlecruiser Smith',
    });
  });

  it('skips a line with no English name', () => {
    expect(
      parseCharacterTitleLine(
        '{"_key":"00851de7-b7ca-5136-871e-d07429563c06","name":{"de":"x"}}',
      ),
    ).toBeNull();
  });

  it('skips blank, malformed and non-uuid lines rather than throwing', () => {
    expect(parseCharacterTitleLine('')).toBeNull();
    expect(parseCharacterTitleLine('{not json')).toBeNull();
    expect(
      parseCharacterTitleLine('{"_key":123,"name":{"en":"x"}}'),
    ).toBeNull();
    expect(
      parseCharacterTitleLine('{"_key":"nope","name":{"en":"x"}}'),
    ).toBeNull();
  });
});
