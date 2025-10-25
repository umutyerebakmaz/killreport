import { Resolvers } from '../generated-types';
import { allianceQueries, allianceMutations } from './alliance.resolver';
import { characterFieldResolvers, characterMutations, characterQueries } from './character.resolver';
import { killmailQueries } from './killmail.resolver';
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
    // User queries
    ...userQueries,

    // Character queries
    ...characterQueries,

    // Killmail queries
    ...killmailQueries,

    // Alliance queries
    ...allianceQueries,
  }, Mutation: {
    // User mutations
    ...userMutations,

    // Character mutations
    ...characterMutations,

    // Alliance mutations
    ...allianceMutations,
  },

  // Field Resolvers - Nested type'lar için
  Character: characterFieldResolvers,
};
