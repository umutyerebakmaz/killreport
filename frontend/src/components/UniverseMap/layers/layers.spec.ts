import { MapCelestialKind } from '@/generated/graphql';
import type { MapCelestial, MapEdge, MapNode } from '@/generated/graphql';
import { hexToRgba, securityColor } from '@/utils/map/colorScales';
import { describe, expect, it } from 'vitest';
import {
  CELESTIAL_COLOR,
  CELESTIAL_RADIUS_PIXELS,
  celestialsLayerProps,
  edgeSegments,
  edgesLayerProps,
  FINE_KINDS,
  GATE_COLOR,
  INTERIOR_KINDS,
  systemsLayerProps,
} from './index';

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

describe('systemsLayerProps', () => {
  const nodes = [node(1, 1.5e17, -2.5e17), node(2, 0.5e17, -1.5e17)];
  const props = systemsLayerProps({ nodes, origin });

  it('hands deck.gl origin-local positions, never galactic ones', () => {
    expect(props.getPosition(nodes[0])).toEqual([5e16, -5e16]);
    expect(props.getPosition(nodes[1])).toEqual([-5e16, 5e16]);
  });

  it('shrinks the largest coordinate the layer will hand to the GPU', () => {
    // Scene-wide, not per node. A node sitting at exactly twice the origin maps
    // to the same magnitude on the other side of it, so "every coordinate
    // shrinks" is simply false — node 2 of this fixture is that case. What the
    // floating origin actually buys is that the largest number reaching a
    // float32 attribute is bounded by the scene rather than by the distance to
    // the galactic centre.
    const largestRaw = Math.max(
      ...nodes.flatMap((n) => [Math.abs(n.x), Math.abs(n.z)]),
    );
    const largestLocal = Math.max(
      ...nodes.flatMap((n) => props.getPosition(n).map(Math.abs)),
    );

    expect(largestLocal).toBeLessThan(largestRaw);
    expect(largestLocal).toBe(5e16);
    expect(largestRaw).toBe(2.5e17);
  });

  it('lets the data drive the radius so a dot becomes a disc on its own', () => {
    expect(props.getRadius(nodes[0])).toBe(3.88e12);
    expect(props.radiusUnits).toBe('common');
    expect(props.radiusMinPixels).toBe(1.5);
  });

  it('colours by security with the shipped ramp', () => {
    expect(props.getFillColor(nodes[0])).toEqual(securityColor(0.9));
  });

  it('rebuilds positions when the origin moves', () => {
    expect(props.updateTriggers?.getPosition).toEqual([origin.x, origin.z]);
  });

  it('is not pickable yet — picking is Phase 3', () => {
    expect(props.pickable).toBe(false);
  });
});

describe('edgeSegments', () => {
  const nodes = [node(1, 1.5e17, -2.5e17), node(2, 0.5e17, -1.5e17)];
  const edges: MapEdge[] = [
    { __typename: 'MapEdge', from: 1, to: 2 } as MapEdge,
  ];

  it('resolves both endpoints into origin-local metres', () => {
    expect(edgeSegments(edges, nodes, origin)).toEqual([
      { from: [5e16, -5e16], to: [-5e16, 5e16] },
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
});

describe('edgesLayerProps', () => {
  const segments = [
    { from: [1, 2] as [number, number], to: [3, 4] as [number, number] },
  ];
  const props = edgesLayerProps({ segments });

  it('reads the endpoints the segments already resolved', () => {
    expect(props.getSourcePosition(segments[0])).toEqual([1, 2]);
    expect(props.getTargetPosition(segments[0])).toEqual([3, 4]);
  });

  it('keeps a hairline visible at galaxy zoom', () => {
    expect(props.widthUnits).toBe('pixels');
    expect(props.widthMinPixels).toBe(0.5);
  });

  it('uses the same line colour as the shipped region maps', () => {
    expect(GATE_COLOR).toEqual(hexToRgba('#94A3B8', 140));
  });

  it('is never pickable: a 0.5 px line cannot be aimed at', () => {
    expect(props.pickable).toBe(false);
  });
});

function celestial(
  kind: MapCelestialKind,
  x: number,
  z: number,
  extra: Partial<MapCelestial> = {},
): MapCelestial {
  return {
    __typename: 'MapCelestial',
    id: 1,
    systemId: 30000142,
    name: 'x',
    kind,
    x,
    z,
    orbitIndex: null,
    planetId: null,
    destinationSystemId: null,
    ...extra,
  } as MapCelestial;
}

describe('celestialsLayerProps', () => {
  // The focused system sits at 1.5e17; the origin is its centre, so its own
  // celestials reduce to their in-system offsets.
  const systemById = new Map([
    [30000142, { x: 1.5e17, z: -2.5e17 }],
    [30000144, { x: 1.6e17, z: -2.5e17 }],
  ]);
  const celestialOrigin = { x: 1.5e17, z: -2.5e17 };

  const celestials = [
    celestial(MapCelestialKind.Star, 0, 0),
    celestial(MapCelestialKind.Planet, 4e10, -2e10, {
      id: 2,
      orbitIndex: 1,
    }),
    celestial(MapCelestialKind.Moon, 4.1e10, -2e10, { id: 3, planetId: 2 }),
    celestial(MapCelestialKind.Gate, -8e10, 1e10, {
      id: 4,
      destinationSystemId: 30000144,
    }),
    celestial(MapCelestialKind.Station, 1e10, 1e10, { id: 5 }),
    celestial(MapCelestialKind.Belt, 5e10, -2e10, { id: 6, planetId: 2 }),
  ];

  const interior = celestialsLayerProps({
    id: 'map-celestials',
    celestials,
    kinds: INTERIOR_KINDS,
    systemById,
    origin: celestialOrigin,
  });

  it('keeps only the kinds it was asked for', () => {
    expect((interior.data as MapCelestial[]).map((c) => c.kind)).toEqual([
      'STAR',
      'PLANET',
      'GATE',
      'STATION',
    ]);
  });

  it('adds the system centre to the in-system offset, then subtracts the origin', () => {
    // The focus is the origin, so its own celestials come through unchanged.
    expect(interior.getPosition(celestials[0])).toEqual([0, 0]);
    expect(interior.getPosition(celestials[1])).toEqual([4e10, -2e10]);
  });

  it('places a neighbour celestial one system-gap away, not at its own offset', () => {
    const neighbourGate = celestial(MapCelestialKind.Gate, 1e10, 0, {
      id: 9,
      systemId: 30000144,
      destinationSystemId: 30000142,
    });
    const props = celestialsLayerProps({
      id: 'map-celestials',
      celestials: [neighbourGate],
      kinds: INTERIOR_KINDS,
      systemById,
      origin: celestialOrigin,
    });

    // 1.6e17 + 1e10 - 1.5e17
    expect(props.getPosition(neighbourGate)[0]).toBeCloseTo(1e16 + 1e10, -6);
  });

  it('drops a celestial whose system is not in the index rather than drawing it at the origin', () => {
    const orphan = celestial(MapCelestialKind.Planet, 1e10, 0, {
      id: 8,
      systemId: 99999,
    });
    const props = celestialsLayerProps({
      id: 'map-celestials',
      celestials: [orphan],
      kinds: INTERIOR_KINDS,
      systemById,
      origin: celestialOrigin,
    });

    expect(props.data).toEqual([]);
  });

  it('draws marks in pixels, not world metres', () => {
    // A world radius derived from the median orbit reads 0.23 px at the interior
    // threshold and 753 px at the ceiling; there is no single world value that
    // works at both ends, because a real planet is ~1e7 m and never spans a
    // pixel. The geometry carries the scale, the marks carry the kind.
    expect(interior.radiusUnits).toBe('pixels');
    expect(interior.getRadius(celestials[0])).toBe(
      CELESTIAL_RADIUS_PIXELS.STAR,
    );
    expect(interior.getRadius(celestials[1])).toBe(
      CELESTIAL_RADIUS_PIXELS.PLANET,
    );
  });

  it('orders the mark hierarchy star > planet > station = gate > moon > belt', () => {
    const r = CELESTIAL_RADIUS_PIXELS;
    expect(r.STAR).toBeGreaterThan(r.PLANET);
    expect(r.PLANET).toBeGreaterThan(r.STATION);
    expect(r.STATION).toBe(r.GATE);
    expect(r.GATE).toBeGreaterThan(r.MOON);
    expect(r.MOON).toBeGreaterThan(r.BELT);
  });

  it('inherits the three colours the shipped SVGs already define', () => {
    // solar-system-map-svg.ts: UNKNOWN_STAR, UNKNOWN_PLANET.
    // star-map-svg.ts: REGION_PALETTE.gate.
    expect(CELESTIAL_COLOR.STAR).toEqual(hexToRgba('#FFF4EA'));
    expect(CELESTIAL_COLOR.PLANET).toEqual(hexToRgba('#9CA3AF'));
    expect(CELESTIAL_COLOR.GATE).toEqual(hexToRgba('#4CC94C'));
  });

  it('is not pickable yet \u2014 picking is Phase 3', () => {
    expect(interior.pickable).toBe(false);
  });

  it('rebuilds positions when the origin moves', () => {
    expect(interior.updateTriggers?.getPosition).toEqual([
      celestialOrigin.x,
      celestialOrigin.z,
    ]);
  });

  it('builds the fine layer from moons and belts only', () => {
    const fine = celestialsLayerProps({
      id: 'map-celestials-fine',
      celestials,
      kinds: FINE_KINDS,
      systemById,
      origin: celestialOrigin,
    });

    expect((fine.data as MapCelestial[]).map((c) => c.kind)).toEqual([
      'MOON',
      'BELT',
    ]);
  });
});
