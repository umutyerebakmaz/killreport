import type { MapEdge, MapNode } from '@/generated/graphql';
import { describe, expect, it } from 'vitest';
import { areaSegments, crossesRegion, edgeSegments, localEdges } from './edges';

function node(
  systemId: number,
  x: number,
  z: number,
  extra: Partial<MapNode> = {},
): MapNode {
  return {
    __typename: 'MapNode',
    systemId,
    name: `S${systemId}`,
    x,
    z,
    radius: 3.88e12,
    securityStatus: 0.9,
    constellationId: 20000001,
    regionId: 10000001,
    ...extra,
  } as MapNode;
}

const origin = { x: 1e17, z: -2e17 };

describe('edgeSegments', () => {
  const nodes = [node(1, 1.5e17, -2.5e17), node(2, 0.5e17, -1.5e17)];
  const edges: MapEdge[] = [
    { __typename: 'MapEdge', from: 1, to: 2 } as MapEdge,
  ];

  it('resolves both endpoints into origin-local metres', () => {
    expect(edgeSegments(edges, nodes, origin)).toEqual([
      {
        from: [5e16, -5e16],
        to: [-5e16, 5e16],
        regions: [10000001, 10000001],
        constellations: [20000001, 20000001],
      },
    ]);
  });

  it('drops an edge whose endpoint is missing rather than drawing it to the origin', () => {
    const orphan: MapEdge[] = [
      { __typename: 'MapEdge', from: 1, to: 999 } as MapEdge,
    ];
    expect(edgeSegments(orphan, nodes, origin)).toEqual([]);
  });

  it('returns an empty list for a scene with no gates, like WORMHOLE', () => {
    expect(edgeSegments([], nodes, origin)).toEqual([]);
  });

  it('carries the constellation at each end too, for the finer highlight', () => {
    const across = [
      node(1, 1.5e17, -2.5e17),
      node(2, 0.5e17, -1.5e17, { constellationId: 20000002 }),
    ];

    expect(edgeSegments(edges, across, origin)[0].constellations).toEqual([
      20000001, 20000002,
    ]);
  });

  it('carries the region at each end, in the order the edge names them', () => {
    // Both ends, not a boolean: the dashes need to know whether they differ
    // and the hover highlight needs to know which two they are.
    const across = [
      node(1, 1.5e17, -2.5e17),
      node(2, 0.5e17, -1.5e17, { regionId: 10000002 }),
    ];

    expect(edgeSegments(edges, across, origin)[0].regions).toEqual([
      10000001, 10000002,
    ]);
  });
});

describe('edgeSegments with loaded gates', () => {
  const gateNodes = [node(1, 1.5e17, -2.5e17), node(2, 1.6e17, -2.5e17)];
  const gateEdges: MapEdge[] = [
    { __typename: 'MapEdge', from: 1, to: 2 } as MapEdge,
  ];
  const gateOrigin = { x: 1.5e17, z: -2.5e17 };

  const gateFrom1 = {
    systemId: 1,
    destinationSystemId: 2,
    x: 3e10,
    z: 0,
  };
  const gateFrom2 = {
    systemId: 2,
    destinationSystemId: 1,
    x: -3e10,
    z: 0,
  };

  it('leaves both ends at the system centres when no interior is loaded', () => {
    expect(edgeSegments(gateEdges, gateNodes, gateOrigin)).toEqual([
      {
        from: [0, 0],
        to: [1e16, 0],
        regions: [10000001, 10000001],
        constellations: [20000001, 20000001],
      },
    ]);
  });

  it('moves the loaded end onto the real stargate', () => {
    const [segment] = edgeSegments(gateEdges, gateNodes, gateOrigin, [
      gateFrom1,
    ]);

    expect(segment.from).toEqual([3e10, 0]);
    // The other end is still the neighbour's centre: we do not know where its
    // gate is until its interior is loaded, and inventing one would be worse.
    expect(segment.to).toEqual([1e16, 0]);
  });

  it('anchors both ends once both interiors are loaded', () => {
    const [segment] = edgeSegments(gateEdges, gateNodes, gateOrigin, [
      gateFrom1,
      gateFrom2,
    ]);

    expect(segment.from).toEqual([3e10, 0]);
    expect(segment.to[0]).toBeCloseTo(1e16 - 3e10, -6);
  });

  it('ignores a gate whose destination is not the other end of this edge', () => {
    const elsewhere = {
      systemId: 1,
      destinationSystemId: 999,
      x: 9e10,
      z: 9e10,
    };

    expect(
      edgeSegments(gateEdges, gateNodes, gateOrigin, [elsewhere])[0].from,
    ).toEqual([0, 0]);
  });

  it('ignores a gate with no destination rather than keying on null', () => {
    const nowhere = {
      systemId: 1,
      destinationSystemId: null,
      x: 9e10,
      z: 9e10,
    };

    expect(
      edgeSegments(gateEdges, gateNodes, gateOrigin, [nowhere])[0].from,
    ).toEqual([0, 0]);
  });
});

describe('localEdges', () => {
  const edges = [
    { from: 1, to: 2 },
    { from: 2, to: 3 },
    { from: 3, to: 4 },
  ] as MapEdge[];

  it('keeps only the edges whose both ends are in the neighbourhood', () => {
    // A half-in edge would run off to a node the local mesh does not place,
    // and its far end would land at the origin. Dropping it is the same rule
    // edgeSegments already follows for an unknown node.
    expect(localEdges(edges, [1, 2, 3])).toEqual([
      { from: 1, to: 2 },
      { from: 2, to: 3 },
    ]);
  });

  it('returns nothing for an empty neighbourhood', () => {
    expect(localEdges(edges, [])).toEqual([]);
  });

  it('does not care about the order of the ids', () => {
    expect(localEdges(edges, [3, 2])).toEqual([{ from: 2, to: 3 }]);
  });
});

describe('crossesRegion', () => {
  const segment = (a: number, b: number) => ({
    from: [0, 0] as [number, number],
    to: [1, 1] as [number, number],
    regions: [a, b] as [number, number],
    constellations: [20000001, 20000001] as [number, number],
  });

  it('is true for the 370 pairs whose ends are in different regions', () => {
    expect(crossesRegion(segment(10000001, 10000002))).toBe(true);
  });

  it('is false inside one region, constellation boundary or not', () => {
    // 915 pairs change constellation without leaving the region. They are
    // ordinary jumps: only the region boundary is drawn.
    expect(crossesRegion(segment(10000001, 10000001))).toBe(false);
  });
});

describe('areaSegments', () => {
  const base = {
    from: [0, 0] as [number, number],
    to: [1, 1] as [number, number],
    regions: [10000001, 10000001] as [number, number],
    constellations: [20000001, 20000001] as [number, number],
  };
  const leavingRegion = {
    ...base,
    regions: [10000001, 10000002] as [number, number],
    constellations: [20000001, 20000002] as [number, number],
  };
  const nextConstellation = {
    ...base,
    constellations: [20000002, 20000002] as [number, number],
  };

  const region = (id: number) => ({ tier: 'region' as const, id });
  const constellation = (id: number) => ({
    tier: 'constellation' as const,
    id,
  });

  it('keeps the edges between the systems of one region', () => {
    expect(areaSegments([base, leavingRegion], region(10000001))).toEqual([
      base,
    ]);
  });

  it('keeps the edges between the systems of one constellation', () => {
    expect(
      areaSegments([base, nextConstellation], constellation(20000001)),
    ).toEqual([base]);
  });

  it('reads the tier it is asked about, not the one it happens to match', () => {
    // The two ids come from different namespaces, so a filter that ignored the
    // tier would still look right on this data until a region and a
    // constellation happened to share a number.
    expect(areaSegments([base], constellation(10000001))).toEqual([]);
    expect(areaSegments([base], region(20000001))).toEqual([]);
  });

  it('drops an edge that leaves the area at either tier', () => {
    // Half of it belongs to the neighbour, and a lit line running out of the
    // highlighted area would blur the shape the highlight exists to show. The
    // border stays unlit, which is what outlines the area.
    expect(areaSegments([leavingRegion], region(10000001))).toEqual([]);
    expect(areaSegments([leavingRegion], constellation(20000001))).toEqual([]);
  });

  it('returns nothing for an area with no edges on this map', () => {
    expect(areaSegments([base], region(10009999))).toEqual([]);
  });
});
