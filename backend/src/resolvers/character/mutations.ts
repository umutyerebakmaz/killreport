import { MutationResolvers } from '@generated-types';
import logger from '@services/logger';
import prisma from '@services/prisma';
import { getRabbitMQChannel } from '@services/rabbitmq';
import redis from '@services/redis';

/**
 * Character Mutation Resolvers
 * Handles operations that modify character data
 */
export const characterMutations: MutationResolvers = {
  refreshCharacter: async (_, { characterId }, context) => {
    try {
      // Rate limiting: Check if character was recently queued (within 5 minutes)
      const rateLimitKey = `refresh:character:${characterId}`;
      const recentlyQueued = await redis.get(rateLimitKey);

      if (recentlyQueued) {
        return {
          success: false,
          message: 'Character was recently queued for refresh. Please wait 5 minutes.',
          characterId,
          queued: false,
        };
      }

      // Check if character exists in database
      const character = await prisma.character.findUnique({
        where: { id: characterId },
        select: { id: true, name: true },
      });

      if (!character) {
        return {
          success: false,
          message: 'Character not found in database',
          characterId,
          queued: false,
        };
      }

      // Queue the character for refresh
      const channel = await getRabbitMQChannel();
      await channel.assertQueue('esi_character_info_queue', {
        durable: true,
        arguments: { 'x-max-priority': 10 },
      });

      const message = {
        entityId: characterId,
        queuedAt: new Date().toISOString(),
        source: 'graphql-mutation',
        userId: context.user?.id, // Track who requested the refresh
      };

      channel.sendToQueue(
        'esi_character_info_queue',
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
      );

      // Set rate limit (5 minutes)
      await redis.setex(rateLimitKey, 300, '1');

      // Invalidate cache
      await redis.del(`character:detail:${characterId}`);

      logger.info(`Character ${characterId} (${character.name}) queued for refresh`, {
        userId: context.user?.id,
      });

      return {
        success: true,
        message: `Character ${character.name} queued for refresh. Updates will be available shortly.`,
        characterId,
        queued: true,
      };
    } catch (error) {
      logger.error('Failed to queue character refresh', { error, characterId });
      return {
        success: false,
        message: 'Failed to queue character for refresh',
        characterId,
        queued: false,
      };
    }
  },
};
