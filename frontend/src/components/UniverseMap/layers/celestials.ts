import { MapCelestialKind } from '@/generated/graphql';
import type { MapCelestial, MapNode } from '@/generated/graphql';
import { hexToRgba, type Rgba } from '@/utils/map/colorScales';
import { toLocal, type MapOrigin } from '@/utils/map/origin';
import type { ScatterplotLayerProps } from '@deck.gl/layers';

export const CELESTIALS_LAYER_ID = 'map-celestials';
export const FINE_LAYER_ID = 'map-celestials-fine';

/**
 * What the interior bucket draws.
 *
 * The enum members, not the string literals: `MapCelestialKind` is a string
 * enum and TypeScript's string enums are nominal, so `'STAR'` is not assignable
 * to it. Same asymmetry the resolver handles with an exhaustive Record.
 */
export const INTERIOR_KINDS: readonly MapCelestialKind[] = [
  MapCelestialKind.Star,
  MapCelestialKind.Planet,
  MapCelestialKind.Station,
  MapCelestialKind.Gate,
];

/** What the fine bucket adds. 344,457 moons exist; none is built below it. */
export const FINE_KINDS: readonly MapCelestialKind[] = [
  MapCelestialKind.Moon,
  MapCelestialKind.Belt,
];

/**
 * Marks, in pixels, not bodies in metres.
 *
 * A world radius derived from the measured geometry (a planet at 5% of the
 * median orbit, 1.8e10 m) is 0.23 px where the interior opens and 753 px at the
 * ceiling — and a star would be 1,507 px. No single world value works at both
 * ends, because a real planet is ~1e7 m and never spans a pixel at any zoom the
 * design reaches. So the geometry carries the scale (orbit radii are real) and
 * the mark carries the kind.
 */
export const CELESTIAL_RADIUS_PIXELS: Record<MapCelestialKind, number> = {
  STAR: 7,
  PLANET: 4.5,
  STATION: 3,
  GATE: 3,
  MOON: 2,
  BELT: 1.5,
};

/**
 * Three of these are inherited rather than chosen, so the map agrees with the
 * diagrams already shipped under frontend/public/images:
 *
 *   STAR   #FFF4EA  solar-system-map-svg.ts UNKNOWN_STAR
 *   PLANET #9CA3AF  solar-system-map-svg.ts UNKNOWN_PLANET
 *   GATE   #4CC94C  star-map-svg.ts REGION_PALETTE.gate
 *
 * The star and planet defaults are used rather than the per-class and per-type
 * tables because `MapCelestial` carries neither `spectralClass` nor `typeId`.
 * Adding them so planets can be coloured by type belongs with Phase 4's colour
 * registry, not here.
 *
 * The other three are chosen: the shipped SVGs draw no stations, moons or
 * belts, so there was nothing to inherit. Station blue for the man-made thing,
 * a dimmer slate for moons so they read as subordinate to their planet, amber
 * for ore. None is one of the four the design's palette audit failed.
 */
export const CELESTIAL_COLOR: Record<MapCelestialKind, Rgba> = {
  STAR: hexToRgba('#FFF4EA'),
  PLANET: hexToRgba('#9CA3AF'),
  STATION: hexToRgba('#38BDF8'),
  GATE: hexToRgba('#4CC94C'),
  MOON: hexToRgba('#64748B'),
  BELT: hexToRgba('#A16207'),
};

export interface CelestialsLayerProps extends ScatterplotLayerProps<MapCelestial> {
  id: string;
  getPosition: (celestial: MapCelestial) => [number, number];
  getRadius: (celestial: MapCelestial) => number;
  getFillColor: (celestial: MapCelestial) => Rgba;
}

export function celestialsLayerProps({
  id,
  celestials,
  kinds,
  systemById,
  origin,
}: {
  id: string;
  celestials: MapCelestial[];
  kinds: readonly MapCelestialKind[];
  systemById: Map<number, Pick<MapNode, 'x' | 'z'>>;
  origin: MapOrigin;
}): CelestialsLayerProps {
  const wanted = new Set<string>(kinds);

  // A celestial whose system is not in the index is dropped rather than drawn
  // at the origin — the same rule the gate edges follow, for the same reason.
  const data = celestials.filter(
    (celestial) =>
      wanted.has(celestial.kind) && systemById.has(celestial.systemId),
  );

  return {
    id,
    data,
    getPosition: (celestial: MapCelestial) => {
      // Two additions, both in float64: the celestial is relative to its own
      // system's centre, and the origin is the focused system's centre.
      const system = systemById.get(celestial.systemId)!;
      return toLocal(origin, system.x + celestial.x, system.z + celestial.z);
    },
    getRadius: (celestial: MapCelestial) =>
      CELESTIAL_RADIUS_PIXELS[celestial.kind],
    getFillColor: (celestial: MapCelestial) => CELESTIAL_COLOR[celestial.kind],
    radiusUnits: 'pixels',
    // Picking, hover and the popup are Phase 3.
    pickable: false,
    updateTriggers: { getPosition: [origin.x, origin.z] },
  };
}
