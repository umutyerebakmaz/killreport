import type { MapCamera } from './camera';
import { nearestNode } from './origin';

/**
 * The switch between the schematic and the galactic layout, as numbers.
 *
 * Only the system dots move: the gate mesh is built once, 14,400 segments, and
 * rebuilding it every frame would stutter. Everything else is hidden for the
 * run and built again in the new layout once it ends (useProjectionMorph).
 */
export const MORPH_DURATION_MS = 600;

export interface MorphPoint {
  x: number;
  z: number;
}

export interface MorphNode extends MorphPoint {
  systemId: number;
}

/** Quadratic ease-in-out, clamped so a frame that runs late lands on the end. */
export function easeInOut(t: number): number {
  const c = Math.min(Math.max(t, 0), 1);
  return c < 0.5 ? 2 * c * c : 1 - (-2 * c + 2) ** 2 / 2;
}

export function lerpPoint(a: MorphPoint, b: MorphPoint, t: number): MorphPoint {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

/** The zoom is already logarithmic, so a straight line in it is an even zoom. */
export function lerpCamera(a: MapCamera, b: MapCamera, t: number): MapCamera {
  return { ...lerpPoint(a, b, t), zoom: a.zoom + (b.zoom - a.zoom) * t };
}

/**
 * Where each system of the layout being left goes, index for index — the
 * sprites were built in that order. Null for a system the new layout does not
 * hold, such as one ESI added after the last SDE import: it fades instead.
 */
export function pairNodes(
  from: readonly MorphNode[],
  to: readonly MorphNode[],
): (MorphPoint | null)[] {
  const target = new Map(to.map((node) => [node.systemId, node]));
  return from.map((node) => {
    const next = target.get(node.systemId);
    return next ? { x: next.x, z: next.z } : null;
  });
}

/**
 * The system the camera follows across the switch: the selected one, else the
 * one nearest the centre of the screen. Null when it is not in the new layout.
 */
export function morphAnchor({
  focus,
  camera,
  from,
  to,
}: {
  focus: number | null;
  camera: MapCamera;
  from: readonly MorphNode[];
  to: readonly MorphNode[];
}): { from: MorphPoint; to: MorphPoint } | null {
  const start =
    (focus !== null && from.find((node) => node.systemId === focus)) ||
    nearestNode([...from], camera.x, camera.z);
  if (!start) return null;
  const end = to.find((node) => node.systemId === start.systemId);
  if (!end) return null;
  return { from: { x: start.x, z: start.z }, to: { x: end.x, z: end.z } };
}

/**
 * Where the camera ends. Looking at the whole galaxy, it ends looking at the
 * whole galaxy. Looking at a corner of it, the anchor stays where it was on
 * screen at the same zoom: the camera moves by exactly the anchor's own
 * displacement.
 */
export function morphTarget({
  camera,
  atFit,
  toFit,
  anchor,
}: {
  camera: MapCamera;
  atFit: boolean;
  toFit: MapCamera;
  anchor: { from: MorphPoint; to: MorphPoint } | null;
}): MapCamera {
  if (atFit || !anchor) return toFit;
  return {
    x: camera.x + (anchor.to.x - anchor.from.x),
    z: camera.z + (anchor.to.z - anchor.from.z),
    zoom: camera.zoom,
  };
}
