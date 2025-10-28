import { Resolvers } from '../generated-types';
import { allianceMutations, allianceQueries } from './alliance.resolver';
import { authMutations, authQueries } from './auth.resolver';
import { characterFieldResolvers, characterMutations, characterQueries } from './character.resolver';
import { killmailMutations, killmailQueries } from './killmail.resolver';
import { userMutations, userQueries } from './user.resolver';

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
    }, Mutation: {
        // Auth mutations
        ...authMutations,

        // User mutations
        ...userMutations,

        // Character mutations
        ...characterMutations,

        // Killmail mutations
        ...killmailMutations,

        // Alliance mutations
        ...allianceMutations,
    },

    // Field Resolvers - Nested type'lar için
    Character: characterFieldResolvers,
};
