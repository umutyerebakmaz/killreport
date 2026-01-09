/**
 * Character Resolvers Barrel Export
 *
 * This index file re-exports all character resolvers using the barrel pattern.
 * This allows clean imports in the parent index.ts:
 * `import { characterQueries, characterMutations, characterFields } from './character'`
 */

export { characterFields } from './fields';
export { characterMutations } from './mutations';
export { characterQueries } from './queries';

