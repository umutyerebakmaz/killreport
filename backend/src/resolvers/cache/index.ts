/**
 * Cache Resolvers Barrel Export
 *
 * This index file re-exports all cache resolvers using the barrel pattern.
 * This allows clean imports in the parent index.ts:
 * `import { cacheQueries, cacheMutations } from './cache'`
 */

export { cacheMutations } from './mutations';
export { cacheQueries } from './queries';

