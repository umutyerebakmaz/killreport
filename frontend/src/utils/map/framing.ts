import type { MapBounds } from '@/generated/graphql';
import { fitCamera, type Framing, type MapCamera } from './camera';
import { SYSTEM_LABEL_ZOOM } from './lod';
import { boundsCenter } from './origin';

/**
 * What framing needs from a node. mapGeometry's nodes already carry all five
 * and are loaded with the scene, which is why this slice needs no query: the
 * answer to "where is region 10000002" is already in the browser.
 */
export interface FramingNode {
  systemId: number;
  constellationId: number;
  regionId: number;
  x: number;
  z: number;
}

/** Null for an empty set: an infinite box is not a smaller mistake than none. */
export function nodeBounds(
  nodes: Pick<FramingNode, 'x' | 'z'>[],
): MapBounds | null {
  if (nodes.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const node of nodes) {
    if (node.x < minX) minX = node.x;
    if (node.x > maxX) maxX = node.x;
    if (node.z < minZ) minZ = node.z;
    if (node.z > maxZ) maxZ = node.z;
  }

  return { minX, maxX, minZ, maxZ };
}

/**
 * The camera a URL parameter asks for, or null to leave the caller on its
 * autofit.
 *
 * Two mechanisms, and the asymmetry is the design. A SYSTEM is centred at a
 * measured constant, so every system arrives at the same scale with its
 * neighbours 59.9 px away. A REGION or CONSTELLATION is framed to the bounds of
 * its nodes, because what is wanted there is the whole set.
 *
 * A cluster with no extent on either axis would send fitZoom to
 * FALLBACK_FIT_ZOOM — the galaxy fit — which would answer "frame this
 * constellation" by showing the galaxy. Two NEW_EDEN constellations hold one
 * system each (Duzna Kah, Manifest District) and five more do in WORMHOLE, so
 * it falls back to the system zoom instead, the same constant a focus uses.
 */
export function framingFor(
  framing: Framing | null,
  nodes: FramingNode[],
  width: number,
  height: number,
): MapCamera | null {
  if (!framing) return null;
  if (!(width > 0) || !(height > 0)) return null;

  if (framing.kind === 'system') {
    const node = nodes.find((candidate) => candidate.systemId === framing.id);
    return node ? { x: node.x, z: node.z, zoom: SYSTEM_LABEL_ZOOM } : null;
  }

  const members = nodes.filter((candidate) =>
    framing.kind === 'constellation'
      ? candidate.constellationId === framing.id
      : candidate.regionId === framing.id,
  );

  const bounds = nodeBounds(members);
  if (!bounds) return null;

  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;
  if (!(spanX > 0) || !(spanZ > 0)) {
    return { ...boundsCenter(bounds), zoom: SYSTEM_LABEL_ZOOM };
  }

  return fitCamera(bounds, width, height);
}
