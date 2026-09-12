import {
  MapGeometry as GeneratedMapGeometry,
  QueryResolvers,
} from '@generated-types';
import { getMapGeometry } from '@services/universe';

/**
 * UniverseMap Query Resolvers
 *
 * Orchestration only; the query, the scope predicate and the cache all live in
 * the service. Passing the generated `MapScope` enum value into the service
 * (which expects its own `'NEW_EDEN' | 'POCHVEN' | 'WORMHOLE'` union) needs no
 * cast — TypeScript accepts a string-enum value where a matching
 * string-literal union is expected. The reverse does not hold: the service's
 * plain string-literal `scope` flowing back out through the enum-typed
 * `MapGeometry.scope` field is rejected by TypeScript's string-enum nominal
 * typing even though the values are identical, so the return needs one cast
 * at that boundary.
 */
export const universeMapQueries: QueryResolvers = {
  mapGeometry: async (_, { scope }) =>
    getMapGeometry(scope) as unknown as Promise<GeneratedMapGeometry>,
};
