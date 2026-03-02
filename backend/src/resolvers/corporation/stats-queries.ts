/**
 * Corporation Statistics Query Resolvers
 *
 * Independent top-level queries for corporation statistics
 * Decoupled from Corporation type for better performance and parallel execution
 */

import { QueryResolvers } from '@generated-types';
import * as CorporationStatsService from '@services/corporation/corporation-stats.service';

/**
 * Corporation Statistics Queries
 * These are top-level queries that can be executed independently
 */
export const corporationStatsQueries: QueryResolvers = {
    /**
     * Get top 10 alliances that a corporation has killed most
     * Cached in Redis with smart TTL based on time filter
     */
    corporationTopAllianceTargets: async (_, { corporationId, filter }) => {
        return CorporationStatsService.getTopAllianceTargets(corporationId, filter);
    },

    /**
     * Get top 10 corporations that a corporation has killed most
     * Cached in Redis with smart TTL based on time filter
     */
    corporationTopCorporationTargets: async (_, { corporationId, filter }) => {
        return CorporationStatsService.getTopCorporationTargets(corporationId, filter);
    },

    /**
     * Get top 10 ship types that a corporation has killed most
     * Cached in Redis with smart TTL based on time filter
     */
    corporationTopShipTargets: async (_, { corporationId, filter }) => {
        return CorporationStatsService.getTopShipTargets(corporationId, filter);
    },

    /**
     * Get top 10 ship types that a corporation has used most (as attacker)
     * Cached in Redis with smart TTL based on time filter
     */
    corporationTopShips: async (_, { corporationId, filter }) => {
        return CorporationStatsService.getTopShips(corporationId, filter);
    },

    /**
     * Get top 10 characters (pilots) with most kills in a corporation
     * Cached in Redis with smart TTL based on time filter
     */
    corporationTopCharacters: async (_, { corporationId, filter }) => {
        return CorporationStatsService.getTopCharacters(corporationId, filter);
    },
};
