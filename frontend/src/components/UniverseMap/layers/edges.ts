import type { MapEdge, MapNode } from '@/generated/graphql';
import { hexToRgba, type Rgba } from '@/utils/map/colorScales';
import { toLocal, type MapOrigin } from '@/utils/map/origin';
import type { LineLayerProps } from '@deck.gl/layers';

export const EDGES_LAYER_ID = 'map-gates';
export const GATE_WIDTH_MIN_PIXELS = 0.5;

/**
 * #94A3B8 at 0.55 alpha — the same line the shipped region SVGs use for an
 * internal jump (backend/src/scripts/star-map-svg.ts, REGION_PALETTE.jump). At
 * galaxy zoom 6.959 of these read as texture, which is the point.
 */
export const GATE_COLOR: Rgba = hexToRgba('#94A3B8', 140);

export interface EdgeSegment {
  from: [number, number];
  to: [number, number];
}

/**
 * Resolves each pair's endpoints once, in float64, into origin-local metres.
 *
 * An edge naming a system that is not in the node list is dropped rather than
 * drawn. The service guarantees this cannot happen — both endpoints go through
 * the same scope predicate — but a silent line to [0, 0] would be the worst
 * possible symptom if that guarantee ever broke.
 */
export function edgeSegments(
  edges: MapEdge[],
  nodes: MapNode[],
  origin: MapOrigin,
): EdgeSegment[] {
  const byId = new Map(nodes.map((node) => [node.systemId, node]));
  const segments: EdgeSegment[] = [];

  for (const edge of edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) continue;

    segments.push({
      from: toLocal(origin, from.x, from.z),
      to: toLocal(origin, to.x, to.z),
    });
  }

  return segments;
}

/** Narrowed for the same reason as SystemsLayerProps: callable from a test. */
export interface EdgesLayerProps extends LineLayerProps<EdgeSegment> {
  id: string;
  getSourcePosition: (segment: EdgeSegment) => [number, number];
  getTargetPosition: (segment: EdgeSegment) => [number, number];
}

export function edgesLayerProps({
  segments,
}: {
  segments: EdgeSegment[];
}): EdgesLayerProps {
  return {
    id: EDGES_LAYER_ID,
    data: segments,
    getSourcePosition: (segment: EdgeSegment) => segment.from,
    getTargetPosition: (segment: EdgeSegment) => segment.to,
    getColor: GATE_COLOR,
    getWidth: 1,
    widthUnits: 'pixels',
    widthMinPixels: GATE_WIDTH_MIN_PIXELS,
    pickable: false,
  };
}
