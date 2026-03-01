/**
 * Character Statistics Query Resolvers
 *
 * Independent top-level queries for character statistics
 * Decoupled from Character type for better performance and parallel execution
 */

import { QueryResolvers } from '@generated-types';
import * as CharacterStatsService from '@services/character/character-stats.service';

/**
 * Character Statistics Queries
 * These are top-level queries that can be executed independently
 */
export const characterStatsQueries: QueryResolvers = {
    /**
     * Get top 10 alliances that a character has killed most
     * Cached in Redis with smart TTL based on time filter
     */
    characterTopAllianceTargets: async (_, { characterId, filter }) => {
        return CharacterStatsService.getTopAllianceTargets(characterId, filter);
    },

    /**
     * Get top 10 corporations that a character has killed most
     * Cached in Redis with smart TTL based on time filter
     */
    characterTopCorporationTargets: async (_, { characterId, filter }) => {
        return CharacterStatsService.getTopCorporationTargets(characterId, filter);
    },

    /**
     * Get top 10 ship types that a character has killed most
     * Cached in Redis with smart TTL based on time filter
     */
    characterTopShipTargets: async (_, { characterId, filter }) => {
        return CharacterStatsService.getTopShipTargets(characterId, filter);
    },

    /**
     * Get top 10 ship types that a character has used most (as attacker)
     * Cached in Redis with smart TTL based on time filter
     */
    characterTopShips: async (_, { characterId, filter }) => {
        return CharacterStatsService.getTopShips(characterId, filter);
    },
};
