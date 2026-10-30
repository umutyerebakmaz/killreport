import { MutationResolvers } from '@generated-types';
import {
  TrackerError,
  trackEntity,
  untrackEntity,
} from '@services/tracker/tracker.service';
import { GraphQLError } from 'graphql';

function requireCharacterId(context: any): number {
  const characterId = context.user?.characterId;
  if (!characterId) {
    throw new GraphQLError('Not authenticated', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return characterId;
}

function toGraphQLError(error: unknown): unknown {
  if (error instanceof TrackerError) {
    return new GraphQLError(error.message, {
      extensions: { code: 'BAD_USER_INPUT', reason: error.code },
    });
  }
  return error;
}

/**
 * Tracker Mutation Resolvers
 */
export const trackerMutations: MutationResolvers = {
  track: async (_parent, { type, id }, context: any) => {
    const characterId = requireCharacterId(context);
    try {
      await trackEntity(characterId, type, id);
    } catch (error) {
      throw toGraphQLError(error);
    }
    return true;
  },

  untrack: async (_parent, { type, id }, context: any) => {
    const characterId = requireCharacterId(context);
    try {
      await untrackEntity(characterId, type, id);
    } catch (error) {
      throw toGraphQLError(error);
    }
    return true;
  },
};
