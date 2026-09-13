import type { MapCelestial, MapEdge, MapNode } from '@/generated/graphql';
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
 * At galaxy zoom both ends are system centres. Once a system's interior is
 * loaded, the end at that system moves onto the **real stargate** heading for
 * the other one — the signature moment of this phase, and the reason
 * `stargates.destination_system_id` is worth carrying all the way to the
 * layer. The mapping is unambiguous by measurement: across 13,978
 * (system, destination) pairs, no system has two gates to the same neighbour.
 *
 * A half-anchored line is correct, not a bug. If the neighbour's interior is
 * not loaded we do not know where its gate is, and its centre is the honest
 * answer.
 *
 * An edge naming a system that is not in the node list is dropped rather than
 * drawn. The service guarantees that cannot happen, but a silent line to
 * [0, 0] would be the worst possible symptom if the guarantee ever broke.
 */
export function edgeSegments(
  edges: MapEdge[],
  nodes: MapNode[],
  origin: MapOrigin,
  gates: Pick<
    MapCelestial,
    'systemId' | 'destinationSystemId' | 'x' | 'z'
  >[] = [],
): EdgeSegment[] {
  const byId = new Map(nodes.map((node) => [node.systemId, node]));

  const gateBetween = new Map<string, (typeof gates)[number]>();
  for (const gate of gates) {
    if (gate.destinationSystemId === null) continue;
    gateBetween.set(`${gate.systemId}->${gate.destinationSystemId}`, gate);
  }

  const endpoint = (system: MapNode, towards: number): [number, number] => {
    const gate = gateBetween.get(`${system.systemId}->${towards}`);
    return gate
      ? toLocal(origin, system.x + gate.x, system.z + gate.z)
      : toLocal(origin, system.x, system.z);
  };

  const segments: EdgeSegment[] = [];

  for (const edge of edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) continue;

    segments.push({
      from: endpoint(from, edge.to),
      to: endpoint(to, edge.from),
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
