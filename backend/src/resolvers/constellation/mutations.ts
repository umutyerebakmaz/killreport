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
      logger.info('🚀 Starting constellation sync via GraphQL...');

      // Get all constellation IDs from ESI
      const response = await axios.get('https://esi.evetech.net/latest/universe/constellations/');
      const constellationIds: number[] = response.data;

      logger.info(`✓ Found ${constellationIds.length} constellations`);
      logger.info(`📤 Publishing to queue...`);

      // RabbitMQ'ya ekle
      const channel = await getRabbitMQChannel();
      const QUEUE_NAME = 'esi_constellations_queue';

      await channel.assertQueue(QUEUE_NAME, {
        durable: true,
      });

      let publishedCount = 0;
      for (const id of constellationIds) {
        channel.sendToQueue(QUEUE_NAME, Buffer.from(id.toString()), {
          persistent: true,
        });
        publishedCount++;
      }

      logger.info(`✅ All ${constellationIds.length} constellations queued successfully!`);
      return {
        success: true,
        message: `${constellationIds.length} constellations queued successfully`,
        clientMutationId: input.clientMutationId || null,
      };
    } catch (error) {
      logger.error('❌ Error starting constellation sync:', error);
      return {
        success: false,
        message: 'Failed to start constellation sync',
        clientMutationId: input.clientMutationId || null,
      };
    }
  },
};
