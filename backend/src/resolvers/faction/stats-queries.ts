/**
 * Faction Statistics Query Resolvers
 *
 * Independent top-level queries for the faction page's Killmails tab.
 * Orchestration only: every query delegates to the faction stats service.
 */

import { QueryResolvers } from '@generated-types';
import * as FactionStatsService from '@services/faction/faction-stats.service';

export const factionStatsQueries: QueryResolvers = {
  factionTopCharacters: async (_, { factionId, filter }) =>
    FactionStatsService.getFactionTopCharacters(factionId, filter) as any,

  factionTopCorporations: async (_, { factionId, filter }) =>
    FactionStatsService.getFactionTopCorporations(factionId, filter) as any,

  factionTopShips: async (_, { factionId, filter }) =>
    FactionStatsService.getFactionTopShips(factionId, filter) as any,

  factionTopFactionTargets: async (_, { factionId, filter }) =>
    FactionStatsService.getFactionTopFactionTargets(factionId, filter) as any,

  factionTopShipTargets: async (_, { factionId, filter }) =>
    FactionStatsService.getFactionTopShipTargets(factionId, filter) as any,
};
