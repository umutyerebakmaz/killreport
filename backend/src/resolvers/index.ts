import { Resolvers } from '../generated-types';
import { allianceFieldResolvers, allianceMutations, allianceQueries } from './alliance.resolver';
import { authMutations, authQueries } from './auth.resolver';
import { characterFieldResolvers, characterQueries } from './character.resolver';
import { corporationFieldResolvers, corporationQueries } from './corporation.resolver';
import { killmailMutations, killmailQueries } from './killmail.resolver';
import { userMutations, userQueries } from './user.resolver';
import { workerResolvers } from './worker.resolver';

/**
 * TÜM RESOLVER'LARI BİRLEŞTİRME
 *
 * Her domain'den gelen resolver'ları tek bir Resolvers object'inde birleştiriyoruz.
 * Bu sayede:
 * 1. Her domain kendi dosyasında organize
 * 2. Yüzlerce satırlık resolver'lar okunabilir
 * 3. Takım çalışması kolaylaşır (merge conflict azalır)
 * 4. Test edilebilirlik artar (her resolver ayrı test edilir)
 */
export const resolvers: Resolvers = {
    Query: {
        // Auth queries
        ...authQueries,

        // User queries
        ...userQueries,

        // Character queries
        ...characterQueries,

        // Killmail queries
        ...killmailQueries,

        // Alliance queries
        ...allianceQueries,

        // Corporation queries
        ...corporationQueries,

        // Worker queries
        ...workerResolvers.Query,
    }, Mutation: {
        // Auth mutations
        ...authMutations,

        // User mutations
        ...userMutations,

        // Killmail mutations
        ...killmailMutations,

        // Alliance mutations
        ...allianceMutations,
    },

    // Subscriptions - Real-time updates
    Subscription: {
        ...workerResolvers.Subscription,
    },

    // Field Resolvers - Nested type'lar için lazy loading
    Character: characterFieldResolvers,
    Alliance: allianceFieldResolvers,
    Corporation: corporationFieldResolvers,
};
