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
      logger.info('🚀 starting dogma effect sync via GraphQL...');

      // Get all dogma effect IDs from ESI
      const effectIds = await DogmaEffectService.getAllEffectIds();

      logger.info(`✓ found ${effectIds.length} dogma effects`);
      logger.info(`📤 publishing to queue...`);

      // Add to RabbitMQ queue
      const channel = await getRabbitMQChannel();
      const QUEUE_NAME = 'esi_dogma_effect_info_queue';

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

      logger.info(`✓ queued ${effectIds.length} dogma effects`);
      logger.info(`📊 run worker with: yarn worker:info:dogma-effects`);

      return {
        success: true,
        message: `Successfully queued ${effectIds.length} dogma effects for sync`,
        clientMutationId: input.clientMutationId,
      };
    } catch (error: any) {
      logger.error('failed to start dogma effect sync', {
        error: error.message,
      });
      return {
        success: false,
        message: `Failed to start sync: ${error.message}`,
        clientMutationId: input.clientMutationId,
      };
    }
  },
};
