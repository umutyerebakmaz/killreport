import { MutationResolvers } from '@generated-types';
import { getRabbitMQChannel } from '@services/rabbitmq';
import axios from 'axios';

/**
 * Region Mutation Resolvers
 * Handles operations that modify region data
 */
export const regionMutations: MutationResolvers = {
  startRegionSync: async (_, { input }) => {
    try {
      console.log('🚀 Starting region sync via GraphQL...');

      // Get all region IDs from ESI
      const response = await axios.get('https://esi.evetech.net/latest/universe/regions/');
      const regionIds: number[] = response.data;

      console.log(`✓ Found ${regionIds.length} regions`);
      console.log(`📤 Publishing to queue...`);

      // RabbitMQ'ya ekle
      const channel = await getRabbitMQChannel();
      const QUEUE_NAME = 'esi_regions_queue';

      await channel.assertQueue(QUEUE_NAME, {
        durable: true,
      });

      let publishedCount = 0;
      for (const id of regionIds) {
        channel.sendToQueue(QUEUE_NAME, Buffer.from(id.toString()), {
          persistent: true,
        });
        publishedCount++;
      }

      console.log(`✅ All ${regionIds.length} regions queued successfully!`);
      return {
        success: true,
        message: `${regionIds.length} regions queued successfully`,
        clientMutationId: input.clientMutationId || null,
      };
    } catch (error) {
      console.error('❌ Error starting region sync:', error);
      return {
        success: false,
        message: 'Failed to start region sync',
        clientMutationId: input.clientMutationId || null,
      };
    }
  },
};
