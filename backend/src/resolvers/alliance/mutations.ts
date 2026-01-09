import { MutationResolvers } from '@generated-types';
import logger from '@services/logger';
import { getRabbitMQChannel } from '@services/rabbitmq';
import axios from 'axios';

/**
 * Alliance Mutation Resolvers
 * Handles operations that modify alliance data
 */
export const allianceMutations: MutationResolvers = {
  startAllianceSync: async (_, { input }) => {
    try {
      logger.info('🚀 Starting alliance sync via GraphQL...');

      // Get all alliance IDs from ESI
      const response = await axios.get('https://esi.evetech.net/latest/alliances/');
      const allianceIds: number[] = response.data;

      logger.info(`✓ Found ${allianceIds.length} alliances`);
      logger.info(`📤 Publishing to queue...`);            // RabbitMQ'ya ekle
      const channel = await getRabbitMQChannel();
      const QUEUE_NAME = 'alliance_queue';

      let publishedCount = 0;
      for (const id of allianceIds) {
        channel.sendToQueue(QUEUE_NAME, Buffer.from(id.toString()), {
          persistent: true,
        });
        publishedCount++;

        // Her 100 alliance'da bir log
        if (publishedCount % 100 === 0) {
          logger.debug(`  ✓ Published ${publishedCount}/${allianceIds.length}`);
        }
      }

      logger.info(`✅ All ${allianceIds.length} alliances queued successfully!`);
      return {
        success: true,
        message: `${allianceIds.length} alliances queued successfully`,
        clientMutationId: input.clientMutationId || null,
      };
    } catch (error) {
      logger.error('❌ Error starting alliance sync:', error);
      return {
        success: false,
        message: 'Failed to start alliance sync',
        clientMutationId: input.clientMutationId || null,
      };
    }
  },
};
