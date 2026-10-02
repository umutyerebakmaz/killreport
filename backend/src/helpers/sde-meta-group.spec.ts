import { describe, expect, it } from 'vitest';

import { parseMetaGroupLine } from './sde-meta-group';

describe('parseMetaGroupLine', () => {
  it('reads the type id and its meta group from an SDE types.jsonl line', () => {
    const line = JSON.stringify({
      _key: 73793,
      name: { en: 'Phoenix Navy Issue' },
      groupID: 485,
      metaGroupID: 4,
      published: true,
    });
    expect(parseMetaGroupLine(line)).toEqual([73793, 4]);
  });

  it('skips a type with no meta group', () => {
    expect(parseMetaGroupLine('{"_key": 34, "groupID": 18}')).toBeNull();
  });

  it('skips blank and malformed lines rather than throwing', () => {
    expect(parseMetaGroupLine('')).toBeNull();
    expect(parseMetaGroupLine('{not json')).toBeNull();
    expect(parseMetaGroupLine('{"_key": "x", "metaGroupID": 4}')).toBeNull();
  });
});
