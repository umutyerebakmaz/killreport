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
            logger.info('🚀 Starting dogma attribute sync via GraphQL...');

            // Get all dogma attribute IDs from ESI
            const attributeIds = await DogmaAttributeService.getAllAttributeIds();

            logger.info(`✓ Found ${attributeIds.length} dogma attributes`);
            logger.info(`📤 Publishing to queue...`);

            // Add to RabbitMQ queue
            const channel = await getRabbitMQChannel();
            const QUEUE_NAME = 'esi_dogma_attribute_info_queue';

            await channel.assertQueue(QUEUE_NAME, {
                durable: true,
                arguments: { 'x-max-priority': 10 },
            });

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

            logger.info(`✓ Queued ${attributeIds.length} dogma attributes`);
            logger.info(`📊 Run worker with: yarn worker:info:dogma-attributes`);

            return {
                success: true,
                message: `Successfully queued ${attributeIds.length} dogma attributes for sync`,
                clientMutationId: input.clientMutationId,
            };
        } catch (error: any) {
            logger.error('Failed to start dogma attribute sync', { error: error.message });
            return {
                success: false,
                message: `Failed to start sync: ${error.message}`,
                clientMutationId: input.clientMutationId,
            };
        }
    },
};
