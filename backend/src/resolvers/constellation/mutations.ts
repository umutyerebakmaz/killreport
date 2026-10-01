import { MutationResolvers } from '@generated-types';
import logger from '@services/logger';
import { getRabbitMQChannel } from '@services/rabbitmq';
import axios from 'axios';

/**
 * Constellation Mutation Resolvers
 * Handles operations that modify constellation data
 */
export const constellationMutations: MutationResolvers = {
  startConstellationSync: async (_, { input }) => {
    try {
      logger.info('🚀 starting constellation sync via GraphQL...');

      // Get all constellation IDs from ESI
      const response = await axios.get(
        'https://esi.evetech.net/latest/universe/constellations/',
      );
      const constellationIds: number[] = response.data;

      logger.info(`✓ found ${constellationIds.length} constellations`);
      logger.info(`📤 publishing to queue...`);

      // Add to RabbitMQ
      const channel = await getRabbitMQChannel();
      const QUEUE_NAME = 'esi_constellations_queue';

      let publishedCount = 0;
      for (const id of constellationIds) {
        channel.sendToQueue(QUEUE_NAME, Buffer.from(id.toString()), {
          persistent: true,
        });
        publishedCount++;
      }

      logger.info(
        `✅ all ${constellationIds.length} constellations queued successfully!`,
      );
      return {
        success: true,
        message: `${constellationIds.length} constellations queued successfully`,
        clientMutationId: input.clientMutationId || null,
      };
    } catch (error) {
      logger.error('❌ error starting constellation sync:', error);
      return {
        success: false,
        message: 'Failed to start constellation sync',
        clientMutationId: input.clientMutationId || null,
      };
    }
  },
};
