import { MapCelestialKind } from '@/generated/graphql';
import { describe, expect, it } from 'vitest';
import {
  CELESTIAL_RADIUS_PX,
  FINE_KINDS,
  INTERIOR_KINDS,
  spriteScale,
  SYSTEM_MAX_FLOOR_PX,
  SYSTEM_MIN_RADIUS_PX,
  systemFloorPx,
  systemRadiusPx,
} from './marks';
import {
  APPROACH_ZOOM,
  CONSTELLATION_LABEL_ZOOM,
  INTERIOR_ZOOM,
  REGION_LABEL_ZOOM,
  SYSTEM_LABEL_ZOOM,
} from './lod';

/** The median system radius, measured against the production database. */
const MEDIAN_RADIUS_M = 3.8809e12;

describe('systemFloorPx', () => {
  it('holds at the old floor for the galaxy view and below', () => {
    expect(systemFloorPx(REGION_LABEL_ZOOM)).toBe(SYSTEM_MIN_RADIUS_PX);
    expect(systemFloorPx(-52)).toBe(SYSTEM_MIN_RADIUS_PX);
    expect(SYSTEM_MIN_RADIUS_PX).toBe(1.5);
  });

  it('holds at the cap from the approach onward', () => {
    expect(systemFloorPx(APPROACH_ZOOM)).toBe(SYSTEM_MAX_FLOOR_PX);
    expect(systemFloorPx(INTERIOR_ZOOM)).toBe(SYSTEM_MAX_FLOOR_PX);
    expect(SYSTEM_MAX_FLOOR_PX).toBe(6);
  });

  // The point of the ramp: a dot used to sit at 1.5 px for the nine zoom levels
  // between the galaxy fit and -41.2, where the data radius finally overtook it.
  it('rises through the zooms that used to be flat', () => {
    const constellation = systemFloorPx(CONSTELLATION_LABEL_ZOOM);
    const system = systemFloorPx(SYSTEM_LABEL_ZOOM);

    expect(constellation).toBeGreaterThan(SYSTEM_MIN_RADIUS_PX);
    expect(system).toBeGreaterThan(constellation);
    expect(system).toBeLessThan(SYSTEM_MAX_FLOOR_PX);

    expect(constellation).toBeCloseTo(2.61, 2);
    expect(system).toBeCloseTo(3.45, 2);
  });

  it('never goes backwards as the camera comes in', () => {
    let previous = 0;
    for (let zoom = -52; zoom <= -34; zoom += 0.25) {
      const floor = systemFloorPx(zoom);
      expect(floor).toBeGreaterThanOrEqual(previous);
      previous = floor;
    }
  });
});

describe('systemRadiusPx', () => {
  it('grows with the camera, which is what turns a point into a disc', () => {
    const scale = 2 ** -36;
    expect(
      systemRadiusPx(MEDIAN_RADIUS_M, scale, systemFloorPx(-36)),
    ).toBeCloseTo(MEDIAN_RADIUS_M * scale, 6);
  });

  it('never falls under the floor, so a galaxy-zoom dot stays visible', () => {
    // 3.88e12 m is 0.003 px at the galaxy fit, so the floor is the whole answer.
    expect(systemRadiusPx(MEDIAN_RADIUS_M, 2 ** -50, systemFloorPx(-50))).toBe(
      systemFloorPx(-50),
    );

    expect(
      systemRadiusPx(
        MEDIAN_RADIUS_M,
        2 ** REGION_LABEL_ZOOM,
        systemFloorPx(REGION_LABEL_ZOOM),
      ),
    ).toBe(SYSTEM_MIN_RADIUS_PX);
  });

  // The ramp must not swallow the disc: past the cap the real radius is what
  // makes a large system look large, and that is the whole approach phase.
  it('hands over to the data radius once that is the bigger of the two', () => {
    const zoom = INTERIOR_ZOOM;
    const radius = systemRadiusPx(
      MEDIAN_RADIUS_M,
      2 ** zoom,
      systemFloorPx(zoom),
    );
    expect(radius).toBeGreaterThan(SYSTEM_MAX_FLOOR_PX);
    expect(radius).toBeCloseTo(MEDIAN_RADIUS_M * 2 ** zoom, 6);
  });

  it('still separates a large system from a small one past the cap', () => {
    const zoom = -38;
    const floor = systemFloorPx(zoom);
    const large = systemRadiusPx(MEDIAN_RADIUS_M * 4, 2 ** zoom, floor);
    const small = systemRadiusPx(MEDIAN_RADIUS_M / 4, 2 ** zoom, floor);
    expect(large).toBeGreaterThan(small);
    expect(small).toBe(floor);
  });
});

describe('spriteScale', () => {
  it('counters the camera so a mark is sized in pixels, not metres', () => {
    // The sprite lives under a container scaled by the camera, so the scale it
    // needs is the pixel size divided by both the texture radius and that
    // camera scale. This is the whole of the 0.60 ms pass.
    expect(spriteScale(1.5, 32, 2 ** -50)).toBeCloseTo(
      1.5 / 32 / 2 ** -50,
      -20,
    );
  });

  it('is independent of the camera in screen terms', () => {
    // Same pixel size at two cameras means the on-screen result matches.
    const a = spriteScale(4, 32, 2 ** -40) * 2 ** -40;
    const b = spriteScale(4, 32, 2 ** -30) * 2 ** -30;
    expect(a).toBeCloseTo(b, 12);
  });
});

describe('celestial marks', () => {
  it('orders the hierarchy star > planet > station = gate > moon > belt', () => {
    const r = CELESTIAL_RADIUS_PX;
    expect(r.STAR).toBeGreaterThan(r.PLANET);
    expect(r.PLANET).toBeGreaterThan(r.STATION);
    expect(r.STATION).toBe(r.GATE);
    expect(r.GATE).toBeGreaterThan(r.MOON);
    expect(r.MOON).toBeGreaterThan(r.BELT);
  });

  it("keeps phase 2's exact pixel sizes", () => {
    expect(CELESTIAL_RADIUS_PX.STAR).toBe(7);
    expect(CELESTIAL_RADIUS_PX.PLANET).toBe(4.5);
    expect(CELESTIAL_RADIUS_PX.STATION).toBe(3);
    expect(CELESTIAL_RADIUS_PX.GATE).toBe(3);
    expect(CELESTIAL_RADIUS_PX.MOON).toBe(2);
    expect(CELESTIAL_RADIUS_PX.BELT).toBe(1.5);
  });

  it('splits the kinds into the two buckets that draw them', () => {
    expect(INTERIOR_KINDS).toEqual([
      MapCelestialKind.Star,
      MapCelestialKind.Planet,
      MapCelestialKind.Station,
      MapCelestialKind.Gate,
    ]);
    expect(FINE_KINDS).toEqual([MapCelestialKind.Moon, MapCelestialKind.Belt]);
  });
});
