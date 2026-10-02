import { describe, expect, it } from 'vitest';

import { getShipTier } from './shipTier';

const TECH_LEVEL = 422;
const META_GROUP = 1692;

const attr = (attribute_id: number, value: number) => ({ attribute_id, value });
const dogma = (...dogmaAttributes: ReturnType<typeof attr>[]) => ({
  dogmaAttributes,
});

describe('getShipTier from the SDE meta group', () => {
  it('reads each meta group that has a badge', () => {
    expect(getShipTier({ metaGroupId: 2 })).toBe('T2');
    expect(getShipTier({ metaGroupId: 14 })).toBe('T3');
    expect(getShipTier({ metaGroupId: 3 })).toBe('faction');
    expect(getShipTier({ metaGroupId: 4 })).toBe('faction');
    expect(getShipTier({ metaGroupId: 5 })).toBe('officer');
    expect(getShipTier({ metaGroupId: 6 })).toBe('officer');
  });

  it('gives Tech I and the other groups no badge', () => {
    for (const metaGroupId of [1, 15, 17, 19, 52, 53, 54]) {
      expect(getShipTier({ metaGroupId })).toBeNull();
    }
  });

  it('wins over the dogma attributes', () => {
    // Phoenix Navy Issue: ESI sent no metaGroupID attribute, the SDE says 4.
    expect(getShipTier({ metaGroupId: 4, ...dogma(attr(TECH_LEVEL, 1)) })).toBe(
      'faction',
    );
  });

  it('falls back to the dogma attributes when it is missing', () => {
    expect(
      getShipTier({ metaGroupId: null, ...dogma(attr(TECH_LEVEL, 2)) }),
    ).toBe('T2');
  });
});

describe('getShipTier from the dogma attributes', () => {
  it('returns null without a ship type or attributes', () => {
    expect(getShipTier(null)).toBeNull();
    expect(getShipTier(undefined)).toBeNull();
    expect(getShipTier({ dogmaAttributes: null })).toBeNull();
    expect(getShipTier(dogma())).toBeNull();
  });

  it('reads tech level 3 as T3 and 2 as T2', () => {
    expect(getShipTier(dogma(attr(TECH_LEVEL, 3)))).toBe('T3');
    expect(getShipTier(dogma(attr(TECH_LEVEL, 2)))).toBe('T2');
  });

  it('lets tech level win over the meta group', () => {
    expect(getShipTier(dogma(attr(TECH_LEVEL, 2), attr(META_GROUP, 4)))).toBe(
      'T2',
    );
    expect(getShipTier(dogma(attr(TECH_LEVEL, 3), attr(META_GROUP, 5)))).toBe(
      'T3',
    );
  });

  it('reads meta groups 5 and 6 as officer and deadspace', () => {
    expect(getShipTier(dogma(attr(META_GROUP, 5)))).toBe('officer');
    expect(getShipTier(dogma(attr(META_GROUP, 6)))).toBe('officer');
  });

  it('reads meta groups 3 and 4 as storyline and faction', () => {
    expect(getShipTier(dogma(attr(META_GROUP, 3)))).toBe('faction');
    expect(getShipTier(dogma(attr(META_GROUP, 4)))).toBe('faction');
  });

  it('returns null for a plain T1 hull', () => {
    expect(
      getShipTier(dogma(attr(TECH_LEVEL, 1), attr(META_GROUP, 1))),
    ).toBeNull();
  });

  it('defaults a missing attribute to 1, so unrelated attributes give no tier', () => {
    expect(getShipTier(dogma(attr(9, 42)))).toBeNull();
  });

  it('returns null for meta group 2, which only the tech level marks as T2', () => {
    // Pinned deliberately: metaGroupID 2 also means T2 in EVE, but the dogma
    // fallback reads the tier from attribute 422 alone and leaves 1692 = 2
    // untiered. The SDE meta group above does read 2 as T2.
    expect(getShipTier(dogma(attr(META_GROUP, 2)))).toBeNull();
  });
});
