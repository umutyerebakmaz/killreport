import { describe, expect, it } from 'vitest';
import { regionMapUrl } from './regionMapUrl';

describe('regionMapUrl', () => {
  it('points at the static map for a region', () => {
    expect(regionMapUrl(10000046)).toBe('/images/regions/10000046.svg');
  });
});
