import {
  MapCelestialKind,
  MapLabelKind,
  QueryResolvers,
} from '@generated-types';
import {
  getMapCelestials,
  getMapGeometry,
  getMapLabels,
  type MapCelestialKind as ServiceCelestialKind,
  type MapLabelKind as ServiceLabelKind,
} from '@services/universe';

/**
 * The service speaks a string-literal union and the schema speaks a string enum.
 * TypeScript's string enums are nominal, so the union does not flow into the
 * enum-typed field — verified, not assumed. An exhaustive Record converts it
 * without a cast: add a kind to the service and this stops compiling, which is
 * exactly what a cast would have hidden.
 */
const CELESTIAL_KIND: Record<ServiceCelestialKind, MapCelestialKind> = {
  STAR: MapCelestialKind.Star,
  PLANET: MapCelestialKind.Planet,
  MOON: MapCelestialKind.Moon,
  BELT: MapCelestialKind.Belt,
  STATION: MapCelestialKind.Station,
  GATE: MapCelestialKind.Gate,
};

/**
 * Same asymmetry as CELESTIAL_KIND above: the service speaks string literals,
 * the schema speaks an enum, and TypeScript's string enums are nominal. An
 * exhaustive Record converts without a cast — add a tier to the service and
 * this stops compiling, which is exactly what a cast would have hidden.
 */
const LABEL_KIND: Record<ServiceLabelKind, MapLabelKind> = {
  REGION: MapLabelKind.Region,
  CONSTELLATION: MapLabelKind.Constellation,
};

/**
 * UniverseMap Query Resolvers
 *
 * Orchestration only; the queries, the scope predicate and the caches all live
 * in the services.
 *
 * `mapGeometry` echoes `scope` back from the argument for the same nominal-enum
 * reason, which costs nothing at runtime — it is the same string.
 */
export const universeMapQueries: QueryResolvers = {
  mapGeometry: async (_, { scope }) => {
    const geometry = await getMapGeometry(scope);
    return { ...geometry, scope };
  },

  mapCelestials: async (_, { systemIds }) => {
    const celestials = await getMapCelestials(systemIds);
    return celestials.map((c) => ({ ...c, kind: CELESTIAL_KIND[c.kind] }));
  },

  mapLabels: async (_, { scope, kind }) => {
    const labels = await getMapLabels(scope, kind);
    return labels.map((l) => ({ ...l, kind: LABEL_KIND[l.kind] }));
  },
};
