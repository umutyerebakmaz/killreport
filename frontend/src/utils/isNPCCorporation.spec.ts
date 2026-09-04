import { describe, expect, it } from 'vitest';

import { isNPCCorporation } from './isNPCCorporation';

describe('isNPCCorporation', () => {
  it('treats ids below two million as NPC corporations', () => {
    expect(isNPCCorporation(1_000_144)).toBe(true);
    expect(isNPCCorporation(1_999_999)).toBe(true);
  });

  it('treats two million and above as player corporations', () => {
    expect(isNPCCorporation(2_000_000)).toBe(false);
    expect(isNPCCorporation(98_000_001)).toBe(false);
  });

  it('is false for a missing id, zero included', () => {
    expect(isNPCCorporation(null)).toBe(false);
    expect(isNPCCorporation(undefined)).toBe(false);
    expect(isNPCCorporation()).toBe(false);
    expect(isNPCCorporation(0)).toBe(false);
  });
});
