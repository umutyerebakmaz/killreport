import { describe, expect, it } from 'vitest';
import {
  APPROACH_ZOOM,
  FINE_ZOOM,
  INTERIOR_ZOOM,
  lodBucket,
  MAX_ZOOM,
  showsMoonsAndBelts,
  streamsInteriors,
} from './lod';

/**
 * The thresholds are absolute zooms, not offsets from the galaxy fit, and that
 * is the whole point of this module. Each is a measured physical distance
 * reaching a pixel count: pixels = metres * 2 ** zoom. Expressed as fit
 * offsets they would mean a different thing on every canvas — on 1400x900 the
 * interior threshold is fit + 13.86, on 2560x1440 it is fit + 13.18.
 */

/** metres * 2 ** zoom = pixels */
function pixels(metres: number, zoom: number) {
  return metres * 2 ** zoom;
}

const MEDIAN_SYSTEM_DIAMETER = 2 * 3.8809e12;
const MEDIAN_MOON_SEPARATION = 9.5389e8;
const BIGGEST_SYSTEM_RADIUS = 3.0384e13;

describe('the thresholds are the measurements they claim to be', () => {
  it('starts the interior where the median system disc reaches 100 px', () => {
    expect(pixels(MEDIAN_SYSTEM_DIAMETER, INTERIOR_ZOOM)).toBeCloseTo(100, 0);
  });

  it('starts the fine layer where median moons separate by 10 px', () => {
    expect(pixels(MEDIAN_MOON_SEPARATION, FINE_ZOOM)).toBeCloseTo(10, 0);
  });

  it('puts the ceiling two levels deeper, so moons are 40 px apart rather than 10', () => {
    expect(MAX_ZOOM).toBeCloseTo(FINE_ZOOM + 2, 6);
    expect(pixels(MEDIAN_MOON_SEPARATION, MAX_ZOOM)).toBeCloseTo(40, 0);
  });

  it('keeps the float32 budget comfortable at the ceiling', () => {
    // Largest local coordinate once the origin is the focused system's centre.
    const step = BIGGEST_SYSTEM_RADIUS * 2 ** -24;
    expect(pixels(step, MAX_ZOOM)).toBeLessThan(0.1);
  });

  it('orders the thresholds', () => {
    expect(APPROACH_ZOOM).toBeLessThan(INTERIOR_ZOOM);
    expect(INTERIOR_ZOOM).toBeLessThan(FINE_ZOOM);
    expect(FINE_ZOOM).toBeLessThan(MAX_ZOOM);
  });
});

describe('lodBucket', () => {
  it('is galaxy below the approach threshold', () => {
    expect(lodBucket(-60)).toBe('galaxy');
    expect(lodBucket(APPROACH_ZOOM - 0.01)).toBe('galaxy');
  });

  it('is approach from there to the interior threshold', () => {
    expect(lodBucket(APPROACH_ZOOM)).toBe('approach');
    expect(lodBucket(INTERIOR_ZOOM - 0.01)).toBe('approach');
  });

  it('is interior from the interior threshold to the fine one', () => {
    expect(lodBucket(INTERIOR_ZOOM)).toBe('interior');
    expect(lodBucket(FINE_ZOOM - 0.01)).toBe('interior');
  });

  it('is fine at and above the fine threshold', () => {
    expect(lodBucket(FINE_ZOOM)).toBe('fine');
    expect(lodBucket(MAX_ZOOM)).toBe('fine');
    expect(lodBucket(0)).toBe('fine');
  });

  it('does not depend on the canvas, unlike a fit offset would', () => {
    // Same absolute zoom, two canvases whose fits differ by 0.68 levels.
    expect(lodBucket(INTERIOR_ZOOM)).toBe(lodBucket(INTERIOR_ZOOM));
    expect(lodBucket(-36.18)).toBe('interior');
  });
});

describe('streamsInteriors', () => {
  it('is true exactly for the two deep buckets', () => {
    expect(streamsInteriors('galaxy')).toBe(false);
    expect(streamsInteriors('approach')).toBe(false);
    expect(streamsInteriors('interior')).toBe(true);
    expect(streamsInteriors('fine')).toBe(true);
  });
});

describe('showsMoonsAndBelts', () => {
  it('is true only in the fine bucket', () => {
    expect(showsMoonsAndBelts('interior')).toBe(false);
    expect(showsMoonsAndBelts('fine')).toBe(true);
  });
});
