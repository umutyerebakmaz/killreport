import { QueryResolvers, TrackedEntityType } from '@generated-types';
import { listWebhooks } from '@services/discord-webhook/discord-webhook.service';
import { GraphQLError } from 'graphql';

/**
 * Discord Webhook Query Resolvers
 */
export const discordWebhookQueries: QueryResolvers = {
  myDiscordWebhooks: async (_parent, _args, context: any) => {
    const characterId = context.user?.characterId;
    if (!characterId) {
      throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }
    const views = await listWebhooks(characterId);
    // Prisma's enum is a string union, GraphQL codegen's a TS enum.
    return views.map((v) => ({
      ...v,
      entityType: v.entityType as TrackedEntityType,
    }));
  },
};
