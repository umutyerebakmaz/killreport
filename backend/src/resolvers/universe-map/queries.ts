import { QueryResolvers } from '@generated-types';
import { getMapGeometry } from '@services/universe';

/**
 * UniverseMap Query Resolvers
 *
 * Orchestration only; the query, the scope predicate and the cache all live in
 * the service.
 *
 * `scope` is echoed back deliberately. TypeScript's string enums are nominal in
 * one direction only: the generated `MapScope` enum value goes into the
 * service's `'NEW_EDEN' | 'POCHVEN' | 'WORMHOLE'` union without a cast, but the
 * union coming back out is not assignable to the enum-typed
 * `MapGeometry.scope` field. Spreading the result and overriding `scope` with
 * the argument we were handed costs nothing at runtime — it is the same string
 * — and keeps a cast out of the resolver.
 */
export const universeMapQueries: QueryResolvers = {
  mapGeometry: async (_, { scope }) => {
    const geometry = await getMapGeometry(scope);
    return { ...geometry, scope };
  },
};
