import type { MapEdge, MapNode } from '@/generated/graphql';
import { securityTint } from './colors';
import type { EdgeSegment } from './edges';
import { SOV_UNOWNED_TINT, sovTint } from './sovColors';

/**
 * Where a system's mark becomes its owner's logo.
 *
 * -46.95 by the user's call on 2026-09-20, replacing the measured -46.2. The
 * measurement said where the marks stop colliding — `pixels = metres * 2 **
 * zoom` (camera.ts), and the nearest-neighbour distances of held systems on
 * 2026-09-19 were p10 1.29e15 m, median 3.47e15 m, p90 6.40e15 m, so -46.2 is
 * where the p10 pair reaches 16 px. This opens the logos EARLIER than that and
 * draws them five times larger, so they overlap by design: reading the
 * territory from far out was worth more than keeping the marks apart.
 *
 * Still inside the label ladder, now just under CONSTELLATION_LABEL_ZOOM
 * (-47.64) to SYSTEM_LABEL_ZOOM (-45.73).
 */
export const SOV_LOGO_ZOOM = -46.95;

export type MapLayerId = 'security' | 'sovereignty';

/**
 * The sovereignty data as the drawing side needs it: one lookup per system and
 * one per owner, both O(1).
 *
 * The owner's tint is resolved once here rather than per sprite — 5,241
 * systems share 101 owners, so a per-sprite dictionary read would do the same
 * hex parse fifty times over.
 */
export interface SovIndex {
  ownerBySystem: Map<number, number>;
  /** Only owners the dictionary names; a miss means "draw it neutral". */
  tintByOwner: Map<number, number>;
}

export interface MapLayerData {
  sovereignty: SovIndex | null;
}

/**
 * What the legend under the switch draws. No row cap: the panel is as tall as
 * the map and scrolls, so the owner legend lists every owner.
 */
export type LegendSpec = { kind: 'security' } | { kind: 'owners' };

export interface MapColorLayer {
  id: MapLayerId;
  label: string;
  /** The system mark's colour. */
  tint: (node: MapNode, data: MapLayerData) => number;
  /** The gate line's colour; null means the neutral grey. */
  edgeTint: (edge: MapEdge, data: MapLayerData) => number | null;
  /** Whether this zoom draws logos in place of the dots. */
  usesLogos: (zoom: number) => boolean;
  legend: LegendSpec;
}

export function buildSovIndex(sov: {
  systems: readonly { systemId: number; ownerId: number }[];
}): SovIndex {
  const ownerBySystem = new Map<number, number>();
  const tintByOwner = new Map<number, number>();

  for (const row of sov.systems) {
    ownerBySystem.set(row.systemId, row.ownerId);
    if (!tintByOwner.has(row.ownerId)) {
      const tint = sovTint(row.ownerId);
      if (tint !== null) tintByOwner.set(row.ownerId, tint);
    }
  }

  return { ownerBySystem, tintByOwner };
}

/** The owner's colour, or null for unheld, uncoloured, or no data at all. */
function ownerTint(systemId: number, data: MapLayerData): number | null {
  const sov = data.sovereignty;
  if (!sov) return null;
  const ownerId = sov.ownerBySystem.get(systemId);
  if (ownerId === undefined) return null;
  return sov.tintByOwner.get(ownerId) ?? null;
}

/**
 * Both layers, as data.
 *
 * `security` records today's map exactly: the security ramp on the marks,
 * neutral gates, no logos. Making it an entry rather than the default branch
 * is what keeps sovereignty from being a special case bolted to the side —
 * when a third layer arrives (activity, geography) it is one more entry here
 * and nothing else changes.
 */
export const MAP_LAYERS: Record<MapLayerId, MapColorLayer> = {
  security: {
    id: 'security',
    label: 'Security',
    tint: (node) => securityTint(node.securityStatus),
    edgeTint: () => null,
    usesLogos: () => false,
    legend: { kind: 'security' },
  },
  sovereignty: {
    id: 'sovereignty',
    label: 'Sovereignty',
    tint: (node, data) => ownerTint(node.systemId, data) ?? SOV_UNOWNED_TINT,
    // A gate is only coloured when BOTH ends are the same owner. A gate
    // between two owners is a border, and leaving it grey is what separates
    // the two territories; splitting it down the middle would show ownership
    // more completely and lose the one line that reads as an edge.
    edgeTint: (edge, data) => {
      const sov = data.sovereignty;
      if (!sov) return null;
      const from = sov.ownerBySystem.get(edge.from);
      const to = sov.ownerBySystem.get(edge.to);
      if (from === undefined || from !== to) return null;
      return sov.tintByOwner.get(from) ?? null;
    },
    usesLogos: (zoom) => zoom >= SOV_LOGO_ZOOM,
    legend: { kind: 'owners' },
  },
};

export interface EdgeGroup {
  /** null is the neutral grey the security layer draws everything in. */
  tint: number | null;
  segments: EdgeSegment[];
}

/**
 * The mesh, split into one path per colour.
 *
 * Pure and here rather than in the scene, because it is the whole of the
 * decision: `scene/edges.ts` only lays the paths down. Worst case is 101
 * colours plus the neutral group, each averaging ~70 segments, and it is a
 * build-once cost — `pixelLine: true` keeps the geometry valid at every zoom,
 * so this runs on a layer change and never on a wheel tick.
 *
 * The neutral group is emitted first so the borders are under the territories.
 */
export function groupSegmentsByTint(
  segments: EdgeSegment[],
  layer: MapColorLayer,
  data: MapLayerData,
): EdgeGroup[] {
  const byTint = new Map<number | null, EdgeSegment[]>();

  for (const segment of segments) {
    const tint = layer.edgeTint(
      { from: segment.systems[0], to: segment.systems[1] },
      data,
    );
    const group = byTint.get(tint);
    if (group) group.push(segment);
    else byTint.set(tint, [segment]);
  }

  const groups: EdgeGroup[] = [];
  const neutral = byTint.get(null);
  if (neutral) groups.push({ tint: null, segments: neutral });
  for (const [tint, group] of byTint) {
    if (tint !== null) groups.push({ tint, segments: group });
  }
  return groups;
}
