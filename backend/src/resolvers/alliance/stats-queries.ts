/**
 * Alliance Statistics Query Resolvers
 *
 * Independent top-level queries for alliance statistics
 * Decoupled from Alliance type for better performance and parallel execution
 */

import { QueryResolvers } from '@generated-types';
import * as AllianceStatsService from '@services/alliance/alliance-stats.service';

/**
 * Alliance Statistics Queries
 * These are top-level queries that can be executed independently
 */
export const allianceStatsQueries: QueryResolvers = {
    /**
     * Get top 10 alliances that an alliance has killed most
     * Cached in Redis with smart TTL based on time filter
     */
    allianceTopAllianceTargets: async (_, { allianceId, filter }) => {
        return AllianceStatsService.getTopAllianceTargets(allianceId, filter);
    },

    /**
     * Get top 10 corporations that an alliance has killed most
     * Cached in Redis with smart TTL based on time filter
     */
    allianceTopCorporationTargets: async (_, { allianceId, filter }) => {
        return AllianceStatsService.getTopCorporationTargets(allianceId, filter);
    },

    /**
     * Get top 10 ship types that an alliance has killed most
     * Cached in Redis with smart TTL based on time filter
     */
    allianceTopShipTargets: async (_, { allianceId, filter }) => {
        return AllianceStatsService.getTopShipTargets(allianceId, filter);
    },

    /**
     * Get top 10 ship types that an alliance has used most (as attacker)
     * Cached in Redis with smart TTL based on time filter
     */
    allianceTopShips: async (_, { allianceId, filter }) => {
        return AllianceStatsService.getTopShips(allianceId, filter);
    },
};
