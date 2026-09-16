import type { MapCelestial, MapEdge, MapNode } from '@/generated/graphql';
import type { LabelTier } from '@/utils/map/lod';
import { toLocal, type MapOrigin } from '@/utils/map/origin';

export interface EdgeSegment {
  from: [number, number];
  to: [number, number];
  /**
   * The region at each end, in the order the edge names them. Read here, from
   * the `regionId` every node already carries, because this is the only place
   * that holds both ends of an edge at once — and it costs the mesh nothing,
   * so the focused neighbourhood gets the same answer as the galaxy.
   *
   * The pair rather than a `crossesRegion` boolean, which is what this was:
   * the dashes only need to know whether the two differ, but the hover
   * highlight needs to know WHICH region an edge belongs to, and one field
   * that answers both cannot fall out of step with itself.
   */
  regions: [number, number];
  /** The same at the finer tier, for the constellation highlight. */
  constellations: [number, number];
  /**
   * The systems the edge runs between. Copied straight off the `MapEdge`,
   * which names them, so that the finest highlight can ask the same question
   * of a segment that the two coarser ones do.
   */
  systems: [number, number];
}

/** The two label tiers that stand for an area a highlight can fill. */
export type MapAreaTier = Exclude<LabelTier, 'system'>;

export interface MapArea {
  tier: MapAreaTier;
  id: number;
}

/** What one name stands for: an area to fill, or a system to radiate from. */
export type MapHighlight = MapArea | { tier: 'system'; id: number };

/**
 * Whether an edge leaves its region, which is what the mesh draws as dashes.
 *
 * The region boundary rather than the constellation one: 370 of the 6,989 gate
 * pairs cross it against 1,285 for a constellation, and a mark that lands on a
 * fifth of the mesh is texture rather than a border.
 */
export function crossesRegion(segment: EdgeSegment): boolean {
  return segment.regions[0] !== segment.regions[1];
}

/**
 * The edges between the systems of one area — both ends inside it.
 *
 * An edge that leaves the area is dropped rather than half-claimed. Half of it
 * belongs to the neighbour, and a lit line running out of the highlighted area
 * would blur the shape the highlight exists to show; leaving the border unlit
 * is what outlines the area instead.
 *
 * One function for both tiers rather than one each: the rule is the same
 * sentence at either scale, and two copies of it would be two places for the
 * "both ends" half to be forgotten.
 */
export function areaSegments(
  segments: EdgeSegment[],
  area: MapArea,
): EdgeSegment[] {
  return segments.filter((segment) => {
    const [from, to] =
      area.tier === 'region' ? segment.regions : segment.constellations;
    return from === area.id && to === area.id;
  });
}

/**
 * The gates of one system — EITHER end at it.
 *
 * The opposite half of the area rule, and deliberately not folded into it. An
 * area is a place with an inside, so its highlight is what the boundary
 * encloses; a system is a point, so every one of its edges leaves it and a
 * "both ends" rule would light nothing at all. The two say different things as
 * well: an area's highlight is "this is the shape of it", a system's is "this
 * is where you can go".
 *
 * 5,268 systems average 2.65 gates, at most 8, and 720 of them have one.
 */
export function systemSegments(
  segments: EdgeSegment[],
  systemId: number,
): EdgeSegment[] {
  return segments.filter(
    (segment) =>
      segment.systems[0] === systemId || segment.systems[1] === systemId,
  );
}

/** The lines one hovered name stands for, by whichever rule its tier uses. */
export function highlightSegments(
  segments: EdgeSegment[],
  target: MapHighlight,
): EdgeSegment[] {
  return target.tier === 'system'
    ? systemSegments(segments, target.id)
    : areaSegments(segments, target);
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
      regions: [from.regionId, to.regionId],
      constellations: [from.constellationId, to.constellationId],
      systems: [edge.from, edge.to],
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
