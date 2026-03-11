import { Resolvers } from '@generated-types';
import { allianceFields, allianceMutations, allianceQueries, allianceStatsQueries } from './alliance';
import { analyticsQueries, analyticsSubscriptions } from './analytics';
import { attackerFields } from './attacker';
import { authMutations, authQueries } from './auth';
import { bloodlineFields, bloodlineQueries } from './bloodline';
import { cacheMutations, cacheQueries } from './cache';
import { categoryFields, categoryMutations, categoryQueries } from './category';
import { characterFields, characterMutations, characterQueries, characterStatsQueries } from './character';
import { constellationFields, constellationMutations, constellationQueries } from './constellation';
import { corporationFields, corporationQueries, corporationStatsQueries } from './corporation';
import { dogmaAttributeMutations, dogmaAttributeQueries } from './dogma-attribute';
import { dogmaEffectMutations, dogmaEffectQueries } from './dogma-effect';
import { itemGroupFields, itemGroupMutations, itemGroupQueries } from './item-group';
import {
    fittingModuleFields,
    killmailFields,
    killmailItemFields,
    killmailMutations,
    killmailQueries,
    killmailSubscriptions,
    victimFields
} from './killmail';
import { leaderboardQueries } from './leaderboard';
import { raceQueries } from './race';
import { regionFields, regionMutations, regionQueries } from './region';
import { solarSystemFields, solarSystemQueries } from './solar-system';
import { systemKillsFields } from './system-kills/fields';
import { systemKillsQueries } from './system-kills/queries';
import { typeFields, typeMutations, typeQueries } from './type';
import { userMutations, userQueries } from './user';
import { workerQueries, workerSubscriptions } from './worker';

export const resolvers: Resolvers = {
    Query: {
        ...authQueries,
        ...userQueries,
        ...characterQueries,
        ...characterStatsQueries,
        ...killmailQueries,
        ...allianceQueries,
        ...allianceStatsQueries,
        ...corporationQueries,
        ...corporationStatsQueries,
        ...raceQueries,
        ...bloodlineQueries,
        ...categoryQueries,
        ...itemGroupQueries,
        ...typeQueries,
        ...dogmaAttributeQueries,
        ...dogmaEffectQueries,
        ...constellationQueries,
        ...regionQueries,
        ...solarSystemQueries,
        ...systemKillsQueries,
        ...cacheQueries,
        ...workerQueries,
        ...analyticsQueries,
        ...leaderboardQueries,
    },
    Mutation: {
        ...authMutations,
        ...userMutations,
        ...characterMutations,
        ...killmailMutations,
        ...allianceMutations,
        ...categoryMutations,
        ...itemGroupMutations,
        ...typeMutations,
        ...dogmaAttributeMutations,
        ...dogmaEffectMutations,
        ...constellationMutations,
        ...regionMutations,
        ...cacheMutations,
    },
    Subscription: {
        ...workerSubscriptions,
        ...killmailSubscriptions,
        ...analyticsSubscriptions,
    },
    Character: characterFields,
    Alliance: allianceFields,
    Bloodline: bloodlineFields,
    Category: categoryFields,
    ItemGroup: itemGroupFields,
    Type: typeFields,
    Corporation: corporationFields,
    Constellation: constellationFields,
    Region: regionFields,
    SolarSystem: solarSystemFields,
    SystemKills: systemKillsFields,
    Killmail: killmailFields,
    Victim: victimFields,
    Attacker: attackerFields,
    KillmailItem: killmailItemFields,
    FittingModule: fittingModuleFields,
};
