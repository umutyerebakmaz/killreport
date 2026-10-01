import { MutationResolvers } from '@generated-types';
import { DogmaAttributeService } from '@services/dogma';
import logger from '@services/logger';
import { getRabbitMQChannel } from '@services/rabbitmq';

/**
 * DogmaAttribute Mutation Resolvers
 * Handles operations that modify dogma attribute data
 */
export const dogmaAttributeMutations: MutationResolvers = {
  startDogmaAttributeSync: async (_, { input }) => {
    try {
      logger.info('🚀 starting dogma attribute sync via GraphQL...');

      // Get all dogma attribute IDs from ESI
      const attributeIds = await DogmaAttributeService.getAllAttributeIds();

      logger.info(`✓ found ${attributeIds.length} dogma attributes`);
      logger.info(`📤 publishing to queue...`);

      // Add to RabbitMQ queue
      const channel = await getRabbitMQChannel();
      const QUEUE_NAME = 'esi_dogma_attribute_info_queue';

      // Queue all attribute IDs
      for (const attributeId of attributeIds) {
        const message = {
          entityId: attributeId,
          queuedAt: new Date().toISOString(),
          source: 'graphql-mutation',
        };

        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
          persistent: true,
        });
      }

      logger.info(`✓ queued ${attributeIds.length} dogma attributes`);
      logger.info(`📊 run worker with: yarn worker:info:dogma-attributes`);

      return {
        success: true,
        message: `Successfully queued ${attributeIds.length} dogma attributes for sync`,
        clientMutationId: input.clientMutationId,
      };
    } catch (error: any) {
      logger.error('failed to start dogma attribute sync', {
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
