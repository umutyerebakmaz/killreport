import { describe, expect, it } from 'vitest';
import { solarSystemMapUrl } from './solarSystemMapUrl';

describe('solarSystemMapUrl', () => {
  it('points at the static map for a solar system', () => {
    expect(solarSystemMapUrl(30000142)).toBe(
      '/images/solar-systems/30000142.svg',
    );
  });
});
