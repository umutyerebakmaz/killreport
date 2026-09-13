import type { MapEdge } from '@/generated/graphql';

/**
 * The systems one gate away. Edges are stored once with `from < to`, so a
 * neighbour can be on either side of the pair.
 *
 * Measured 2026-09-13: out-degree maxes at 8 and averages 2.65, so the focus
 * plus its neighbours is at most 9 systems — comfortably inside mapCelestials'
 * cap of 16.
 */
export function gateNeighbours(
  edges: Pick<MapEdge, 'from' | 'to'>[],
  systemId: number,
): number[] {
  const neighbours = new Set<number>();

  for (const edge of edges) {
    if (edge.from === systemId && edge.to !== systemId) neighbours.add(edge.to);
    else if (edge.to === systemId && edge.from !== systemId)
      neighbours.add(edge.from);
  }

  return [...neighbours];
}
