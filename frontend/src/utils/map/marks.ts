import { MapCelestialKind } from '@/generated/graphql';
import { APPROACH_ZOOM, REGION_LABEL_ZOOM } from './lod';

/**
 * The floor at the galaxy view, where every system is a point and none of them
 * has any extent worth drawing.
 */
export const SYSTEM_MIN_RADIUS_PX = 1.5;

/**
 * Where the floor stops growing and the real radius takes the marks over.
 *
 * Measured: the median system radius is 3.8809e12 m, so the data crosses 6 px at
 * zoom -39.2 — just past APPROACH_ZOOM, which is where the discs are meant to
 * start separating anyway. A cap much higher would keep every system the same
 * size well into the approach and flatten exactly the difference that phase
 * exists to show.
 */
export const SYSTEM_MAX_FLOOR_PX = 6;

/**
 * The floor, as a function of the zoom rather than a constant.
 *
 * A fixed 1.5 px floor left the dots flat for the nine zoom levels between the
 * galaxy fit and -41.2, where the median system's own radius finally overtook
 * it: you could zoom in a long way and nothing grew. The ramp runs between the
 * two zooms that already mean something — REGION_LABEL_ZOOM, where the first
 * names appear, and APPROACH_ZOOM, where the discs begin — so the marks grow in
 * step with the labels instead of on a schedule of their own.
 *
 * Linear in zoom, which is exponential in scale: zoom is logarithmic, so a
 * straight line here is the gentle curve on screen.
 */
export function systemFloorPx(zoom: number): number {
  if (zoom <= REGION_LABEL_ZOOM) return SYSTEM_MIN_RADIUS_PX;
  if (zoom >= APPROACH_ZOOM) return SYSTEM_MAX_FLOOR_PX;

  const progress =
    (zoom - REGION_LABEL_ZOOM) / (APPROACH_ZOOM - REGION_LABEL_ZOOM);
  return (
    SYSTEM_MIN_RADIUS_PX +
    progress * (SYSTEM_MAX_FLOOR_PX - SYSTEM_MIN_RADIUS_PX)
  );
}

/**
 * A point turns into a disc without a mode switch: below the floor every system
 * draws at the floor, and once its own radius is the larger of the two the data
 * takes over on its own.
 *
 * The floor is passed in rather than derived here. It is one value for a whole
 * pass over 5,241 sprites, and recovering the zoom from the scale per sprite
 * would be 5,241 logarithms for an answer that cannot change between them.
 */
export function systemRadiusPx(
  worldRadius: number,
  cameraScale: number,
  floorPx: number,
): number {
  return Math.max(worldRadius * cameraScale, floorPx);
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
