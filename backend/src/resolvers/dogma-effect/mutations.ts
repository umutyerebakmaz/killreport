import { MutationResolvers } from '@generated-types';
import { DogmaEffectService } from '@services/dogma';
import logger from '@services/logger';
import { getRabbitMQChannel } from '@services/rabbitmq';

/**
 * DogmaEffect Mutation Resolvers
 * Handles operations that modify dogma effect data
 */
export const dogmaEffectMutations: MutationResolvers = {
  startDogmaEffectSync: async (_, { input }) => {
    try {
      logger.info('🚀 Starting dogma effect sync via GraphQL...');

      // Get all dogma effect IDs from ESI
      const effectIds = await DogmaEffectService.getAllEffectIds();

      logger.info(`✓ Found ${effectIds.length} dogma effects`);
      logger.info(`📤 Publishing to queue...`);

      // Add to RabbitMQ queue
      const channel = await getRabbitMQChannel();
      const QUEUE_NAME = 'esi_dogma_effect_info_queue';

      await channel.assertQueue(QUEUE_NAME, {
        durable: true,
        arguments: { 'x-max-priority': 10 },
      });

      // Queue all effect IDs
      for (const effectId of effectIds) {
        const message = {
          entityId: effectId,
          queuedAt: new Date().toISOString(),
          source: 'graphql-mutation',
        };

        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
          persistent: true,
        });
      }

      logger.info(`✓ Queued ${effectIds.length} dogma effects`);
      logger.info(`📊 Run worker with: yarn worker:info:dogma-effects`);

      return {
        success: true,
        message: `Successfully queued ${effectIds.length} dogma effects for sync`,
        clientMutationId: input.clientMutationId,
      };
    } catch (error: any) {
      logger.error('Failed to start dogma effect sync', { error: error.message });
      return {
        success: false,
        message: `Failed to start sync: ${error.message}`,
        clientMutationId: input.clientMutationId,
      };
    }
  },
};
