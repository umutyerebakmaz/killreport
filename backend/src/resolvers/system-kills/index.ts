import { systemKillsFields } from './fields';
import { systemKillsQueries } from './queries';

export const systemKillsResolvers = {
    Query: systemKillsQueries,
    SystemKills: systemKillsFields,
};
