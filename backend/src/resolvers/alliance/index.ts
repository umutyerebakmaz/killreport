/**
 * Alliance Resolvers Barrel Export
 *
 * This index file re-exports all alliance resolvers using the barrel pattern.
 * This allows clean imports in the parent index.ts:
 * `import { allianceQueries, allianceMutations, allianceFields } from './alliance'`
 */

export { allianceFields } from './fields';
export { allianceMutations } from './mutations';
export { allianceQueries } from './queries';

