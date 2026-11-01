import { MutationResolvers, TrackedEntityType } from '@generated-types';
import {
  DiscordWebhookError,
  removeWebhook,
  setWebhook,
} from '@services/discord-webhook/discord-webhook.service';
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
  if (error instanceof DiscordWebhookError) {
    return new GraphQLError(error.message, {
      extensions: { code: 'BAD_USER_INPUT', reason: error.code },
    });
  }
  return error;
}

/**
 * Discord Webhook Mutation Resolvers
 */
export const discordWebhookMutations: MutationResolvers = {
  setDiscordWebhook: async (_parent, { type, id, url }, context: any) => {
    const characterId = requireCharacterId(context);
    try {
      const view = await setWebhook(characterId, type, id, url);
      // Prisma's enum is a string union, GraphQL codegen's a TS enum.
      return { ...view, entityType: view.entityType as TrackedEntityType };
    } catch (error) {
      throw toGraphQLError(error);
    }
  },

  removeDiscordWebhook: async (_parent, { type, id }, context: any) => {
    const characterId = requireCharacterId(context);
    try {
      await removeWebhook(characterId, type, id);
    } catch (error) {
      throw toGraphQLError(error);
    }
    return true;
  },
};
