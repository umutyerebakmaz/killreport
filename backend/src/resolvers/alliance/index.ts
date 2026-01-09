/**
 * Alliance Resolvers Barrel Export
 *
 * This index file re-exports all alliance resolvers using the barrel pattern.
 * This allows clean imports with aliases in the parent index.ts:
 * `import { queries as allianceQueries, mutations as allianceMutations, fields as allianceFields } from './alliance'`
 */

export { fields } from './fields';
export { mutations } from './mutations';
export { queries } from './queries';

