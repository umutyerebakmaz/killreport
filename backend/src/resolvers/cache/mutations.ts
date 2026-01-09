import { MutationResolvers } from '@generated-types';
import logger from '@services/logger';
import CacheManager from '@utils/cache-manager';

/**
 * Cache Mutation Resolvers
 * Handles cache invalidation and clearing operations
 */
export const cacheMutations: MutationResolvers = {
  clearKillmailCache: async (_, { killmailId }) => {
    try {
      await CacheManager.clearKillmail(killmailId);
      return {
        success: true,
        message: `Cache cleared for killmail ${killmailId}`,
        deletedKeys: null,
      };
    } catch (error) {
      logger.error(`Error clearing killmail cache for ${killmailId}:`, error);
      return {
        success: false,
        message: `Failed to clear cache: ${error}`,
        deletedKeys: null,
      };
    }
  },

  clearCharacterCache: async (_, { characterId }) => {
    try {
      await CacheManager.clearCharacter(characterId);
      return {
        success: true,
        message: `Cache cleared for character ${characterId}`,
        deletedKeys: null,
      };
    } catch (error) {
      logger.error(`Error clearing character cache for ${characterId}:`, error);
      return {
        success: false,
        message: `Failed to clear cache: ${error}`,
        deletedKeys: null,
      };
    }
  },

  clearCorporationCache: async (_, { corporationId }) => {
    try {
      await CacheManager.clearCorporation(corporationId);
      return {
        success: true,
        message: `Cache cleared for corporation ${corporationId}`,
        deletedKeys: null,
      };
    } catch (error) {
      logger.error(`Error clearing corporation cache for ${corporationId}:`, error);
      return {
        success: false,
        message: `Failed to clear cache: ${error}`,
        deletedKeys: null,
      };
    }
  },

  clearAllianceCache: async (_, { allianceId }) => {
    try {
      await CacheManager.clearAlliance(allianceId);
      return {
        success: true,
        message: `Cache cleared for alliance ${allianceId}`,
        deletedKeys: null,
      };
    } catch (error) {
      logger.error(`Error clearing alliance cache for ${allianceId}:`, error);
      return {
        success: false,
        message: `Failed to clear cache: ${error}`,
        deletedKeys: null,
      };
    }
  },

  clearAllKillmailCaches: async () => {
    try {
      await CacheManager.clearAllKillmails();
      return {
        success: true,
        message: 'All killmail caches cleared',
        deletedKeys: null,
      };
    } catch (error) {
      logger.error('Error clearing all killmail caches:', error);
      return {
        success: false,
        message: `Failed to clear caches: ${error}`,
        deletedKeys: null,
      };
    }
  },
};
