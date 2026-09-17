import { describe, expect, it } from 'vitest';

import { getItemName, isBlueprint } from './itemType';

const rifter = {
  id: 587,
  name: 'Rifter',
  group: { name: 'Frigate', category: { name: 'Ship' } },
};
const rifterBlueprint = {
  id: 787,
  name: 'Rifter Blueprint',
  group: { name: 'Frigate Blueprint', category: { name: 'Blueprint' } },
};

describe('isBlueprint', () => {
  it('recognises the Blueprint category regardless of case', () => {
    expect(isBlueprint(rifterBlueprint)).toBe(true);
    expect(isBlueprint({ group: { category: { name: 'BLUEPRINT' } } })).toBe(
      true,
    );
  });

  it('falls back to the name when the category is missing', () => {
    expect(isBlueprint({ name: 'Rifter Blueprint' })).toBe(true);
    expect(isBlueprint({ name: 'Rifter' })).toBe(false);
  });

  it('is false for other categories, empty objects and null', () => {
    expect(isBlueprint(rifter)).toBe(false);
    expect(isBlueprint({})).toBe(false);
    expect(isBlueprint(null)).toBe(false);
  });
});

describe('getItemName', () => {
  it('returns the plain name for ships and blueprint originals', () => {
    expect(getItemName(rifter)).toBe('Rifter');
    expect(getItemName(rifter, 2)).toBe('Rifter');
    expect(getItemName(rifterBlueprint, 1)).toBe('Rifter Blueprint');
  });

  it('appends Copy only for a blueprint with singleton 2', () => {
    expect(getItemName(rifterBlueprint, 2)).toBe('Rifter Blueprint Copy');
  });

  it('returns an empty string without a type', () => {
    expect(getItemName(null)).toBe('');
    expect(getItemName({})).toBe('');
  });
});
