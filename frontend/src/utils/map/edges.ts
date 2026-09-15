import type { MapCelestial, MapEdge, MapNode } from '@/generated/graphql';
import { toLocal, type MapOrigin } from '@/utils/map/origin';

export interface EdgeSegment {
  from: [number, number];
  to: [number, number];
  /**
   * Whether the two systems sit in different regions. Decided here, on the
   * `regionId` every node already carries, because this is the only place that
   * holds both ends of an edge at once — and it costs the mesh nothing, so the
   * focused neighbourhood gets the same answer as the galaxy.
   *
   * The region boundary rather than the constellation one: 370 of the 6,989
   * gate pairs cross it against 1,285 for a constellation, and a mark that
   * lands on a fifth of the mesh is texture rather than a border.
   */
  crossesRegion: boolean;
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
      crossesRegion: from.regionId !== to.regionId,
    });
  }

  return segments;
}

/**
 * The edges of one neighbourhood, both ends inside it.
 *
 * A half-contained edge is dropped rather than drawn. Its far end would be
 * placed correctly — `drawEdges` is given the whole of `geometry.nodes`, not
 * just the neighbourhood — but at the zoom where the local mesh is on screen
 * that end is a long way outside the viewport, so the edge reads as a line
 * running off to nowhere. The galaxy mesh, which does show those connections,
 * is hidden at this zoom.
 */
export function localEdges(edges: MapEdge[], systemIds: number[]): MapEdge[] {
  const inside = new Set(systemIds);
  return edges.filter((edge) => inside.has(edge.from) && inside.has(edge.to));
}
