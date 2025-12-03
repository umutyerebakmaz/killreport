import { Resolvers } from '../generated-types';
import { allianceFieldResolvers, allianceMutations, allianceQueries } from './alliance.resolver';
import { authMutations, authQueries } from './auth.resolver';
import { bloodlineQueries } from './bloodline.resolver';
import { categoryFieldResolvers, categoryMutations, categoryQueries } from './category.resolver';
import { characterFieldResolvers, characterQueries } from './character.resolver';
import { constellationFieldResolvers, constellationMutations, constellationQueries } from './constellation.resolver';
import { corporationFieldResolvers, corporationQueries } from './corporation.resolver';
import { killmailMutations, killmailQueries } from './killmail.resolver';
import { raceQueries } from './race.resolver';
import { regionFieldResolvers, regionMutations, regionQueries } from './region.resolver';
import { solarSystemFieldResolvers, solarSystemMutations, solarSystemQueries } from './solarSystem.resolver';
import { userMutations, userQueries } from './user.resolver';
import { workerResolvers } from './worker.resolver';

export const resolvers: Resolvers = {
    Query: {
        ...authQueries,
        ...userQueries,
        ...characterQueries,
        ...killmailQueries,
        ...allianceQueries,
        ...corporationQueries,
        ...raceQueries,
        ...bloodlineQueries,
        ...categoryQueries,
        ...constellationQueries,
        ...regionQueries,
        ...solarSystemQueries,
        ...workerResolvers.Query,
    },
    Mutation: {
        ...authMutations,
        ...userMutations,
        ...killmailMutations,
        ...allianceMutations,
        ...categoryMutations,
        ...constellationMutations,
        ...regionMutations,
        ...solarSystemMutations,
    },
    Subscription: {
        ...workerResolvers.Subscription,
    },
    Character: characterFieldResolvers,
    Alliance: allianceFieldResolvers,
    Category: categoryFieldResolvers,
    Corporation: corporationFieldResolvers,
    Constellation: constellationFieldResolvers,
    Region: regionFieldResolvers,
    SolarSystem: solarSystemFieldResolvers,
};
