/**
 * Category Resolvers Barrel Export
 *
 * This index file re-exports all category resolvers using the barrel pattern.
 * This allows clean imports in the parent index.ts:
 * `import { categoryQueries, categoryMutations, categoryFields } from './category'`
 */

export { categoryFields } from './fields';
export { categoryMutations } from './mutations';
export { categoryQueries } from './queries';

