import { MapCelestialKind } from '@/generated/graphql';
import { describe, expect, it } from 'vitest';
import {
  CELESTIAL_RADIUS_PX,
  FINE_KINDS,
  INTERIOR_KINDS,
  spriteScale,
  SYSTEM_MIN_RADIUS_PX,
  systemRadiusPx,
} from './marks';

describe('systemRadiusPx', () => {
  it('grows with the camera, which is what turns a point into a disc', () => {
    // The median system radius is 3.8809e12 m.
    expect(systemRadiusPx(3.8809e12, 2 ** -36)).toBeCloseTo(
      3.8809e12 * 2 ** -36,
      6,
    );
  });

  it('never falls under the floor, so a galaxy-zoom dot stays visible', () => {
    // At the fit, 3.88e12 m is far below a pixel.
    expect(systemRadiusPx(3.8809e12, 2 ** -50)).toBe(SYSTEM_MIN_RADIUS_PX);
    expect(SYSTEM_MIN_RADIUS_PX).toBe(1.5);
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
