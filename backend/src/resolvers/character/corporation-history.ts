/**
 * Character Corporation History Resolvers
 *
 * Independent top-level query for the Employment History tab
 */

import {
  CharacterCorporationHistoryResolvers,
  QueryResolvers,
} from '@generated-types';
import * as CharacterCorporationHistoryService from '@services/character/character-corporation-history.service';

export const characterCorporationHistoryQueries: QueryResolvers = {
  characterCorporationHistory: async (_, { characterId }) => {
    return CharacterCorporationHistoryService.getCorporationHistory(
      characterId,
    );
  },
};

export const characterCorporationHistoryFields: CharacterCorporationHistoryResolvers =
  {
    corporation: async (parent, _args, context) => {
      // Null until the corporation info worker has resolved it
      const corporation = await context.loaders.corporation.load(
        parent.corporationId,
      );
      if (!corporation) return null;

      return {
        ...corporation,
        date_founded: corporation.date_founded?.toISOString() || null,
      };
    },
  };
