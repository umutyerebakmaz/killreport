import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { getItemImageUrl, getItemName, isBlueprint } from './itemImageUrl';

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

let consoleLog: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  consoleLog.mockRestore();
});

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

describe('getItemImageUrl', () => {
  it('returns an empty string without a type id', () => {
    expect(getItemImageUrl(null)).toBe('');
    expect(getItemImageUrl({ name: 'Rifter' })).toBe('');
  });

  it('builds the icon URL for regular items, 64px by default', () => {
    expect(getItemImageUrl(rifter)).toBe(
      'https://images.evetech.net/types/587/icon?size=64',
    );
    expect(getItemImageUrl(rifter, 1, 128)).toBe(
      'https://images.evetech.net/types/587/icon?size=128',
    );
  });

  it('uses the bp variant for a blueprint original and bpc for a copy', () => {
    expect(getItemImageUrl(rifterBlueprint, 1)).toBe(
      'https://images.evetech.net/types/787/bp?size=64',
    );
    expect(getItemImageUrl(rifterBlueprint, 2, 32)).toBe(
      'https://images.evetech.net/types/787/bpc?size=32',
    );
  });
});
