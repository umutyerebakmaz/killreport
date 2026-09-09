import { describe, expect, it } from 'vitest';
import { constellationMapUrl } from './constellationMapUrl';

describe('constellationMapUrl', () => {
  it('points at the static map for a constellation', () => {
    expect(constellationMapUrl(20000020)).toBe(
      '/images/constellations/20000020.svg',
    );
  });
});
