import type { MapEdge, MapNode } from '@/generated/graphql';
import { securityTint } from './colors';
import { SOV_UNOWNED_TINT, sovTint } from './sovColors';

/**
 * Where a system's mark becomes its owner's logo.
 *
 * Measured, not chosen. `pixels = metres * 2 ** zoom` (camera.ts), and the
 * nearest-neighbour distances of held systems were measured against production
 * on 2026-09-19: p10 1.29e15 m, median 3.47e15 m, p90 6.40e15 m. -46.2 is
 * where the p10 pair reaches 16 px — so at this zoom 90% of held systems have
 * room for a 16 px mark. It lands between CONSTELLATION_LABEL_ZOOM (-47.64)
 * and SYSTEM_LABEL_ZOOM (-45.73): logos arrive after constellation names and
 * just before system names.
 */
export const SOV_LOGO_ZOOM = -46.2;

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

/** What the legend under the switch draws. */
export type LegendSpec = { kind: 'security' } | { kind: 'owners'; max: number };

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
    legend: { kind: 'owners', max: 10 },
  },
};
