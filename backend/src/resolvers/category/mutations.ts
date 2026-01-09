import { MutationResolvers } from '@generated-types';
import { CategoryService } from '@services/category';
import { getRabbitMQChannel } from '@services/rabbitmq';

/**
 * Category Mutation Resolvers
 * Handles operations that modify category data
 */
export const categoryMutations: MutationResolvers = {
  startCategorySync: async (_, { input }) => {
    try {
      console.log('🚀 Starting category sync via GraphQL...');

      // Get all category IDs from ESI
      const categoryIds = await CategoryService.getAllCategoryIds();

      console.log(`✓ Found ${categoryIds.length} categories`);
      console.log(`📤 Publishing to queue...`);

      // RabbitMQ'ya ekle
      const channel = await getRabbitMQChannel();
      const QUEUE_NAME = 'esi_category_info_queue';

      await channel.assertQueue(QUEUE_NAME, {
        durable: true,
        arguments: { 'x-max-priority': 10 },
      });

      let publishedCount = 0;
      for (const id of categoryIds) {
        const message = {
          entityId: id,
          queuedAt: new Date().toISOString(),
          source: 'startCategorySync',
        };
        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
          persistent: true,
        });
        publishedCount++;
      }

      console.log(`✅ All ${categoryIds.length} categories queued successfully!`);
      return {
        success: true,
        message: `${categoryIds.length} categories queued successfully`,
        clientMutationId: input.clientMutationId || null,
      };
    } catch (error) {
      console.error('❌ Error starting category sync:', error);
      return {
        success: false,
        message: 'Failed to start category sync',
        clientMutationId: input.clientMutationId || null,
      };
    }
  },
};
