import { describe, expect, it } from 'vitest';

import { getShipTier } from './shipTier';

const TECH_LEVEL = 422;
const META_GROUP = 1692;

const attr = (attribute_id: number, value: number) => ({ attribute_id, value });

describe('getShipTier', () => {
  it('returns null without attributes', () => {
    expect(getShipTier(null)).toBeNull();
    expect(getShipTier(undefined)).toBeNull();
    expect(getShipTier([])).toBeNull();
  });

  it('reads tech level 3 as T3 and 2 as T2', () => {
    expect(getShipTier([attr(TECH_LEVEL, 3)])).toBe('T3');
    expect(getShipTier([attr(TECH_LEVEL, 2)])).toBe('T2');
  });

  it('lets tech level win over the meta group', () => {
    expect(getShipTier([attr(TECH_LEVEL, 2), attr(META_GROUP, 4)])).toBe('T2');
    expect(getShipTier([attr(TECH_LEVEL, 3), attr(META_GROUP, 5)])).toBe('T3');
  });

  it('reads meta groups 5 and 6 as officer and deadspace', () => {
    expect(getShipTier([attr(META_GROUP, 5)])).toBe('officer');
    expect(getShipTier([attr(META_GROUP, 6)])).toBe('officer');
  });

  it('reads meta groups 3 and 4 as storyline and faction', () => {
    expect(getShipTier([attr(META_GROUP, 3)])).toBe('faction');
    expect(getShipTier([attr(META_GROUP, 4)])).toBe('faction');
  });

  it('returns null for a plain T1 hull', () => {
    expect(getShipTier([attr(TECH_LEVEL, 1), attr(META_GROUP, 1)])).toBeNull();
  });

  it('defaults a missing attribute to 1, so unrelated attributes give no tier', () => {
    expect(getShipTier([attr(9, 42)])).toBeNull();
  });

  it('returns null for meta group 2, which only the tech level marks as T2', () => {
    // Pinned deliberately: metaGroupID 2 also means T2 in EVE, but this helper
    // reads the tier from attribute 422 alone and leaves 1692 = 2 untiered.
    expect(getShipTier([attr(META_GROUP, 2)])).toBeNull();
  });
});
