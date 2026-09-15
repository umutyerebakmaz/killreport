import { describe, expect, it } from 'vitest';
import {
  APPROACH_ZOOM,
  CONSTELLATION_LABEL_ZOOM,
  FINE_ZOOM,
  INTERIOR_ZOOM,
  layerVisibility,
  lodBucket,
  MAX_ZOOM,
  REGION_LABEL_ZOOM,
  showsMoonsAndBelts,
  streamsInteriors,
  SYSTEM_LABEL_ZOOM,
  visibleLabelTiers,
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

describe('layerVisibility', () => {
  it('draws the galaxy edge mesh and the systems, and nothing else, at galaxy zoom', () => {
    expect(layerVisibility('galaxy')).toEqual({
      edgesGalaxy: true,
      edgesHighlight: true,
      edgesLocal: false,
      systems: true,
      celestials: false,
      fine: false,
    });
  });

  it('changes nothing on approach — the discs grow on their own', () => {
    expect(layerVisibility('approach')).toEqual(layerVisibility('galaxy'));
  });

  it('swaps the galaxy mesh for the local one when interiors open', () => {
    // The galaxy mesh is hidden rather than kept: its vertices are float32 in
    // scene-centre-local metres, which is 0.22 px at galaxy zoom and useless
    // this far in. The local mesh is rebuilt around the focused system instead.
    const v = layerVisibility('interior');
    expect(v.edgesGalaxy).toBe(false);
    // With it: a region highlight is a highlight OF the galaxy mesh, so it
    // cannot outlive the mesh it draws over.
    expect(v.edgesHighlight).toBe(false);
    expect(v.edgesLocal).toBe(true);
    expect(v.celestials).toBe(true);
    expect(v.fine).toBe(false);
  });

  it('adds moons and belts only in the fine bucket', () => {
    expect(layerVisibility('fine').fine).toBe(true);
    expect(layerVisibility('fine').edgesLocal).toBe(true);
  });

  it('keeps the systems visible in every bucket', () => {
    for (const bucket of ['galaxy', 'approach', 'interior', 'fine'] as const) {
      expect(layerVisibility(bucket).systems).toBe(true);
    }
  });
});

describe('label thresholds', () => {
  it("is the zoom at which each tier's median neighbour reaches 60 px", () => {
    // Measured 2026-09-14: median nearest-neighbour distance is 7.4114e16 m for
    // regions, 1.3129e16 for constellations, 3.4944e15 for systems. A name needs
    // ~60 px of separation to read, so the threshold is log2(60 / distance).
    expect(REGION_LABEL_ZOOM).toBeCloseTo(Math.log2(60 / 7.4114e16), 2);
    expect(CONSTELLATION_LABEL_ZOOM).toBeCloseTo(Math.log2(60 / 1.3129e16), 2);
    expect(SYSTEM_LABEL_ZOOM).toBeCloseTo(Math.log2(60 / 3.4944e15), 2);
  });

  it('opens the coarsest tier first and the finest last', () => {
    expect(REGION_LABEL_ZOOM).toBeLessThan(CONSTELLATION_LABEL_ZOOM);
    expect(CONSTELLATION_LABEL_ZOOM).toBeLessThan(SYSTEM_LABEL_ZOOM);
  });

  it('has regions readable from the galaxy fit itself', () => {
    // The fit is -50.04 on 1400x900 and -49.36 on 2560x1440; both are above the
    // region threshold, so region names are on the very first frame.
    expect(REGION_LABEL_ZOOM).toBeLessThan(-50.04);
  });

  it('opens every label tier below the approach threshold', () => {
    // All three land inside the galaxy bucket, which is why label visibility is
    // derived from the zoom directly rather than from a bucket.
    expect(SYSTEM_LABEL_ZOOM).toBeLessThan(-40);
  });
});

describe('visibleLabelTiers', () => {
  it('shows nothing below the region threshold', () => {
    // The camera can go two levels under the fit; at that distance 114 names
    // would sit on top of each other.
    expect(visibleLabelTiers(-52)).toEqual([]);
  });

  it('shows regions alone from their threshold up', () => {
    expect(visibleLabelTiers(-50)).toEqual(['region']);
    expect(visibleLabelTiers(-48)).toEqual(['region']);
  });

  it('accumulates rather than handing over', () => {
    // A tier opening does not close the one beneath it: zooming in adds names,
    // it does not swap them. The coarser tier stays as background context, the
    // way a map keeps a country name while showing cities.
    expect(visibleLabelTiers(-47)).toEqual(['region', 'constellation']);
    expect(visibleLabelTiers(-45)).toEqual([
      'region',
      'constellation',
      'system',
    ]);
  });

  it('keeps all three at the deepest zoom', () => {
    expect(visibleLabelTiers(-24.51)).toEqual([
      'region',
      'constellation',
      'system',
    ]);
  });

  it('returns the tiers coarsest first, which is the collision priority', () => {
    // The filter places labels in this order and drops what will not fit, so
    // the tier sacrificed in a crowd is always the finest one.
    expect(visibleLabelTiers(-45)[0]).toBe('region');
  });
});
