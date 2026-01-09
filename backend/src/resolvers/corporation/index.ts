/**
 * Corporation Resolvers Barrel Export
 *
 * This index file re-exports all corporation resolvers using the barrel pattern.
 * This allows clean imports in the parent index.ts:
 * `import { corporationQueries, corporationFields } from './corporation'`
 */

export { corporationFields } from './fields';
export { corporationQueries } from './queries';

