import { MapCelestialKind } from '@/generated/graphql';

/**
 * A 1.5 px floor with a data-driven radius is what makes a point turn into a
 * disc without a mode switch: at galaxy zoom every system is the floor, and by
 * the time the median system's 3.8809e12 m radius crosses 1.5 px the disc takes
 * over on its own.
 */
export const SYSTEM_MIN_RADIUS_PX = 1.5;

export function systemRadiusPx(
  worldRadius: number,
  cameraScale: number,
): number {
  return Math.max(worldRadius * cameraScale, SYSTEM_MIN_RADIUS_PX);
}

/**
 * The counter-scale. A sprite hangs under the camera container, so to occupy
 * `radiusPx` on screen it must divide out both the texture's own radius and the
 * camera's scale. Measured at 0.60 ms for all 5,241 systems, which is why the
 * systems layer stays a scene graph instead of becoming a shader.
 */
export function spriteScale(
  radiusPx: number,
  textureRadiusPx: number,
  cameraScale: number,
): number {
  return radiusPx / textureRadiusPx / cameraScale;
}

/**
 * Marks in pixels, not bodies in metres. A world radius derived from the
 * measured geometry is 0.23 px where the interior opens and 753 px at the
 * ceiling, because a real planet is ~1e7 m and never spans a pixel at any zoom
 * this design reaches. The geometry carries the scale, the mark carries the kind.
 */
export const CELESTIAL_RADIUS_PX: Record<MapCelestialKind, number> = {
  STAR: 7,
  PLANET: 4.5,
  STATION: 3,
  GATE: 3,
  MOON: 2,
  BELT: 1.5,
};

export const INTERIOR_KINDS: readonly MapCelestialKind[] = [
  MapCelestialKind.Star,
  MapCelestialKind.Planet,
  MapCelestialKind.Station,
  MapCelestialKind.Gate,
];

/** 344,457 moons exist; none is built below the fine bucket. */
export const FINE_KINDS: readonly MapCelestialKind[] = [
  MapCelestialKind.Moon,
  MapCelestialKind.Belt,
];
