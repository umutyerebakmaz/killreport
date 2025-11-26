import { Resolvers } from '../generated-types';
import { allianceFieldResolvers, allianceMutations, allianceQueries } from './alliance.resolver';
import { authMutations, authQueries } from './auth.resolver';
import { bloodlineQueries } from './bloodline.resolver';
import { characterFieldResolvers, characterQueries } from './character.resolver';
import { corporationFieldResolvers, corporationQueries } from './corporation.resolver';
import { killmailMutations, killmailQueries } from './killmail.resolver';
import { raceQueries } from './race.resolver';
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
        ...regionQueries,
        ...workerResolvers.Query,
    },
    Mutation: {
        ...authMutations,
        ...userMutations,
        ...killmailMutations,
        ...allianceMutations,
        ...regionMutations,
    },
    Subscription: {
        ...workerResolvers.Subscription,
    },
    Character: characterFieldResolvers,
    Alliance: allianceFieldResolvers,
    Corporation: corporationFieldResolvers,
    Region: regionFieldResolvers,
};
