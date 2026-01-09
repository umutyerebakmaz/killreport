import { MutationResolvers } from '@generated-types';
import logger from '@services/logger';
import prisma from '@services/prisma';
import { getRabbitMQChannel } from '@services/rabbitmq';
import { TypeService } from '@services/type';

/**
 * Type Mutation Resolvers
 * Handles operations that modify type data
 */
export const typeMutations: MutationResolvers = {
  startTypeSync: async (_, { input }) => {
    try {
      logger.info('🚀 Starting type sync via GraphQL...');

      // Get all type IDs from ESI (fetches from all item groups)
      const typeIds = await TypeService.getTypeIds();

      logger.info(`✓ Found ${typeIds.length} types`);
      logger.info(`📤 Publishing to queue...`);

      // RabbitMQ'ya ekle
      const channel = await getRabbitMQChannel();
      const QUEUE_NAME = 'esi_type_info_queue';

      await channel.assertQueue(QUEUE_NAME, {
        durable: true,
        arguments: { 'x-max-priority': 10 },
      });

      let publishedCount = 0;
      for (const id of typeIds) {
        const message = {
          entityId: id,
          queuedAt: new Date().toISOString(),
          source: 'startTypeSync',
        };
        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
          persistent: true,
        });
        publishedCount++;
      }

      logger.info(`✅ Queued ${publishedCount} types for sync`);

      return {
        success: true,
        message: `Successfully queued ${publishedCount} types for sync`,
        clientMutationId: input.clientMutationId,
      };
    } catch (error) {
      logger.error('❌ Error starting type sync:', error);
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        clientMutationId: input.clientMutationId,
      };
    }
  },

  startTypeDogmaSync: async (_, { input }) => {
    try {
      logger.info('🚀 Starting type dogma sync via GraphQL...');

      const channel = await getRabbitMQChannel();
      const QUEUE_NAME = 'esi_type_dogma_queue';

      await channel.assertQueue(QUEUE_NAME, {
        durable: true,
        arguments: { 'x-max-priority': 10 },
      });

      let typeIds: number[];

      // If specific type IDs provided, use them; otherwise get all types from DB
      if (input.typeIds && input.typeIds.length > 0) {
        typeIds = input.typeIds.map(id => Number(id));
        logger.info(`✓ Using ${typeIds.length} specified type IDs`);
      } else {
        const types = await prisma.type.findMany({
          select: { id: true },
        });
        typeIds = types.map(t => t.id);
        logger.info(`✓ Found ${typeIds.length} types in database`);
      }

      logger.info(`📤 Publishing to queue...`);

      let publishedCount = 0;
      for (const id of typeIds) {
        const message = {
          entityId: id,
          queuedAt: new Date().toISOString(),
          source: 'startTypeDogmaSync',
        };
        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
          persistent: true,
        });
        publishedCount++;
      }

      logger.info(`✅ Queued ${publishedCount} types for dogma sync`);

      return {
        success: true,
        message: `Successfully queued ${publishedCount} types for dogma sync`,
        queuedCount: publishedCount,
        clientMutationId: input.clientMutationId,
      };
    } catch (error) {
      logger.error('❌ Error starting type dogma sync:', error);
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        queuedCount: 0,
        clientMutationId: input.clientMutationId,
      };
    }
  },
};
