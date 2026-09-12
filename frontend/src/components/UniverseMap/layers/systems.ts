import type { MapNode } from '@/generated/graphql';
import { securityColor, type Rgba } from '@/utils/map/colorScales';
import { nodePosition, type MapOrigin } from '@/utils/map/origin';
import type { ScatterplotLayerProps } from '@deck.gl/layers';

export const SYSTEMS_LAYER_ID = 'map-systems';

/**
 * A 1.5 px floor with a data-driven radius is what makes a point turn into a
 * disc without a mode switch: at galaxy zoom every system is the floor, and by
 * the time the median system's 3.88e12 m radius crosses 1.5 px the disc takes
 * over on its own.
 */
export const SYSTEM_RADIUS_MIN_PIXELS = 1.5;

/**
 * The accessors are narrowed to single-argument functions rather than left as
 * deck.gl's `Accessor` union. The layer accepts either — a one-argument
 * function is assignable to deck.gl's two-argument `AccessorFunction` — but
 * only this form is callable from a test without a cast, and being callable
 * from a test is the entire reason these builders return props instead of
 * layer instances.
 */
export interface SystemsLayerProps extends ScatterplotLayerProps<MapNode> {
  id: string;
  getPosition: (node: MapNode) => [number, number];
  getRadius: (node: MapNode) => number;
  getFillColor: (node: MapNode) => Rgba;
}

export function systemsLayerProps({
  nodes,
  origin,
}: {
  nodes: MapNode[];
  origin: MapOrigin;
}): SystemsLayerProps {
  return {
    id: SYSTEMS_LAYER_ID,
    data: nodes,
    getPosition: nodePosition(origin),
    getRadius: (node: MapNode) => node.radius,
    getFillColor: (node: MapNode) => securityColor(node.securityStatus),
    // 'common' is world units. The default is 'meters', which in a
    // non-geospatial view resolves to the same thing, but saying it outright
    // keeps the metre contract visible at the layer boundary.
    radiusUnits: 'common',
    radiusMinPixels: SYSTEM_RADIUS_MIN_PIXELS,
    // Picking, hover and the popup are Faz 3.
    pickable: false,
    updateTriggers: { getPosition: [origin.x, origin.z] },
  };
}
