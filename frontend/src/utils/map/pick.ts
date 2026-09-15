import type { CameraTransform } from './camera';
import { systemFloorPx, systemRadiusPx } from './marks';

/**
 * The smallest clickable radius, in pixels.
 *
 * At galaxy zoom every system is `SYSTEM_MIN_RADIUS_PX` — 1.5 px — and a 1.5 px
 * target cannot be hit. Phase 1-2's design wrote deck.gl's `pickingRadius: 4`,
 * which was an extra margin AROUND the mark; this is the total radius instead,
 * so 6 rather than 4.
 *
 * It is a judgement, not a measurement. Systems sit a median 3.4944e15 m apart
 * (`lod.ts`), which is 59.9 px at SYSTEM_LABEL_ZOOM and 3.0 px at the galaxy
 * fit — so down there neighbouring targets overlap and the nearest one wins.
 * Tune by looking.
 */
export const MIN_PICK_RADIUS_PX = 6;

/**
 * Whatever the dot actually occupies on screen, floored so it can be hit.
 *
 * Built from the drawn radius rather than from the data alone, so the target can
 * never be smaller than the mark: SYSTEM_MAX_FLOOR_PX is 6 and so is this floor,
 * which means they meet exactly where the zoom ramp stops. Raising the drawn cap
 * without raising this one would put a dot on screen larger than its own
 * clickable area, and the expression below is what keeps that from being
 * possible rather than merely unlikely.
 */
export function pickRadiusPx(
  worldRadius: number,
  cameraScale: number,
  floorPx: number,
): number {
  return Math.max(
    systemRadiusPx(worldRadius, cameraScale, floorPx),
    MIN_PICK_RADIUS_PX,
  );
}

/** What picking needs from a node: where it is, how big, and what to show. */
export interface PickNode {
  systemId: number;
  name: string;
  x: number;
  z: number;
  radius: number;
  securityStatus: number;
}

export interface PickTarget {
  node: PickNode;
  /** Where the node's centre is, so the caller does not project it again. */
  screenX: number;
  screenY: number;
}

/**
 * The system under a pointer, or null.
 *
 * The projection is the multiply-add `cameraTransform` already describes — note
 * that scaleY is NEGATIVE, so a larger z lands at a smaller screen y. That is
 * the map's +z-is-up contract, and the one thing here that silently inverts if
 * copied wrong. `utils/map/labels.ts` carries the same warning.
 *
 * Linear over the scene's nodes. 5,241 at the most, one multiply-add each, and
 * the label pass already walks the same array on every camera change. The
 * caller throttles this to an animation frame.
 *
 * The cheap rejection is an axis-aligned test against the POINTER, not a
 * viewport clip: the pointer is inside the viewport by definition, so a box
 * around it rejects strictly more nodes than the viewport does, and with one
 * subtraction per axis. Only what survives both axes pays for a squared
 * distance.
 */
export function pickSystem({
  nodes,
  transform,
  pointerX,
  pointerY,
  cameraScale,
}: {
  nodes: PickNode[];
  transform: CameraTransform;
  pointerX: number;
  pointerY: number;
  cameraScale: number;
}): PickTarget | null {
  let best: PickTarget | null = null;
  let bestDistance = Infinity;

  // One value for the whole scan, exactly as in scaleSystems: the floor depends
  // on the zoom alone, not on the node.
  const floorPx = systemFloorPx(Math.log2(cameraScale));

  for (const node of nodes) {
    const radius = pickRadiusPx(node.radius, cameraScale, floorPx);

    const screenX = node.x * transform.scaleX + transform.x;
    const dx = screenX - pointerX;
    if (dx > radius || dx < -radius) continue;

    const screenY = node.z * transform.scaleY + transform.y;
    const dy = screenY - pointerY;
    if (dy > radius || dy < -radius) continue;

    const distance = dx * dx + dy * dy;
    if (distance > radius * radius) continue;
    // Strictly nearer, so the first of two equidistant nodes wins and the
    // result does not depend on the array being re-sorted upstream.
    if (distance >= bestDistance) continue;

    bestDistance = distance;
    best = { node, screenX, screenY };
  }

  return best;
}

/**
 * The same PickTarget a hit test would produce, for a system already known by
 * id — a label click, where WHAT was clicked is not in doubt and only its
 * position still has to be computed.
 *
 * Linear over the node list, and deliberately not indexed: it runs on a click
 * or on a hover frame, never per raw pointermove. `onHoverSystem` calls it for
 * every hover frame spent over a name, which the hook has already coalesced to
 * one per frame.
 */
export function pickById(
  nodes: PickNode[],
  systemId: number,
  transform: CameraTransform,
): PickTarget | null {
  const node = nodes.find((candidate) => candidate.systemId === systemId);
  if (!node) return null;

  return {
    node,
    screenX: node.x * transform.scaleX + transform.x,
    screenY: node.z * transform.scaleY + transform.y,
  };
}
