import { MutationResolvers } from '@generated-types';
import { ItemGroupService } from '@services/item-group';
import { getRabbitMQChannel } from '@services/rabbitmq';

/**
 * ItemGroup Mutation Resolvers
 * Handles operations that modify item group data
 */
export const itemGroupMutations: MutationResolvers = {
  startItemGroupSync: async (_, { input }) => {
    try {
      console.log('🚀 Starting item group sync via GraphQL...');

      // Get all item group IDs from ESI
      const itemGroupIds = await ItemGroupService.getItemGroupIds();

      console.log(`✓ Found ${itemGroupIds.length} item groups`);
      console.log(`📤 Publishing to queue...`);

      // RabbitMQ'ya ekle
      const channel = await getRabbitMQChannel();
      const QUEUE_NAME = 'esi_item_group_info_queue';

      await channel.assertQueue(QUEUE_NAME, {
        durable: true,
        arguments: { 'x-max-priority': 10 },
      });

      let publishedCount = 0;
      for (const id of itemGroupIds) {
        const message = {
          entityId: id,
          queuedAt: new Date().toISOString(),
          source: 'startItemGroupSync',
        };
        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
          persistent: true,
        });
        publishedCount++;
      }

      console.log(`✅ All ${itemGroupIds.length} item groups queued successfully!`);
      return {
        success: true,
        message: `${itemGroupIds.length} item groups queued successfully`,
        clientMutationId: input.clientMutationId || null,
      };
    } catch (error) {
      console.error('❌ Error starting item group sync:', error);
      return {
        success: false,
        message: 'Failed to start item group sync',
        clientMutationId: input.clientMutationId || null,
      };
    }
  },
};
