import type { MapEdge, MapNode } from '@/generated/graphql';
import { hexToRgba, securityColor } from '@/utils/map/colorScales';
import { describe, expect, it } from 'vitest';
import {
  edgeSegments,
  edgesLayerProps,
  GATE_COLOR,
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
