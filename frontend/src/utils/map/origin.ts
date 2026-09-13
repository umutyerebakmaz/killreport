import type { MapBounds, MapNode } from '@/generated/graphql';

/**
 * The floating origin. Every layer receives `object - origin`, the subtraction
 * happens here in float64, and the origin is the centre of the scene in Phase 1
 * (the focused system's centre from Phase 2 on).
 *
 * Why it exists, in one number: a raw galactic coordinate is ~1e18 m, float32
 * quantises it to ~6e10 m, and at the deepest zoom the design reaches that is
 * 598 px of jitter. Relative to the scene centre the same step is 2.85e10 m,
 * which is 0.22 px at the zoom Phase 1 stops at.
 */
export interface MapOrigin {
  x: number;
  z: number;
}

/** float32 keeps 24 significand bits, so this is its relative resolution. */
export const FLOAT32_RELATIVE_STEP = 2 ** -24;

export function boundsCenter(bounds: MapBounds): MapOrigin {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    z: (bounds.minZ + bounds.maxZ) / 2,
  };
}

export function toLocal(
  origin: MapOrigin,
  x: number,
  z: number,
): [number, number] {
  return [x - origin.x, z - origin.z];
}

/** The accessor every layer hands to deck.gl. Nothing else may build positions. */
export function nodePosition(origin: MapOrigin) {
  return (node: Pick<MapNode, 'x' | 'z'>): [number, number] =>
    toLocal(origin, node.x, node.z);
}

export function maxLocalMagnitude(
  origin: MapOrigin,
  nodes: Pick<MapNode, 'x' | 'z'>[],
): number {
  let max = 0;
  for (const node of nodes) {
    const [x, z] = toLocal(origin, node.x, node.z);
    max = Math.max(max, Math.abs(x), Math.abs(z));
  }
  return max;
}

export function float32StepMetres(magnitude: number): number {
  return magnitude * FLOAT32_RELATIVE_STEP;
}

/** deck.gl's orthographic zoom is logarithmic: pixels = metres * 2 ** zoom. */
export function float32StepPixels(magnitude: number, zoom: number): number {
  return float32StepMetres(magnitude) * 2 ** zoom;
}

/**
 * The node whose centre is nearest a point. Linear over the scene's nodes —
 * 5,241 at the most, scanned only when the LOD bucket says interiors stream,
 * which is exactly when there is practically one system on screen anyway.
 */
export function nearestNode<T extends Pick<MapNode, 'x' | 'z'>>(
  nodes: T[],
  x: number,
  z: number,
): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;

  for (const node of nodes) {
    const dx = node.x - x;
    const dz = node.z - z;
    const distance = dx * dx + dz * dz;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = node;
    }
  }

  return best;
}

/**
 * Which origin to subtract. Phase 1 used the scene centre everywhere, which is
 * fine while the galaxy is on screen and catastrophic once it is not: at the
 * deepest zoom the scene centre puts float32's step at 299 px, against 0.019 px
 * for the focused system's centre. The switch happens at the interior
 * threshold, where there is practically one system on screen, so the origin is
 * stable up there rather than changing under every pan.
 */
export function originFor(
  bounds: MapBounds,
  focus: Pick<MapNode, 'x' | 'z'> | null,
): MapOrigin {
  return focus ? { x: focus.x, z: focus.z } : boundsCenter(bounds);
}
