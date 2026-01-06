import { MutationResolvers, PageInfo, QueryResolvers } from '../generated-types';
import { DogmaAttributeService } from '../services/dogma';
import logger from '../services/logger';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';
import redis from '../services/redis';

export const dogmaAttributeQueries: QueryResolvers = {
    dogmaAttribute: async (_, { id }) => {
        const cacheKey = `dogma-attribute:detail:${id}`;

        // Check cache first
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }

        const dogmaAttribute = await prisma.dogmaAttribute.findUnique({
            where: { id: Number(id) },
        });
        if (!dogmaAttribute) return null;

        const result = {
            ...dogmaAttribute,
            created_at: dogmaAttribute.created_at.toISOString(),
            updated_at: dogmaAttribute.updated_at.toISOString(),
        } as any;

        // Cache for 24 hours (dogma data rarely changes)
        await redis.setex(cacheKey, 86400, JSON.stringify(result));
        return result;
    },

    dogmaAttributes: async (_, { filter }) => {
        const take = filter?.limit ?? 25;
        const currentPage = filter?.page ?? 1;
        const skip = (currentPage - 1) * take;

        // Build where conditions
        const where: any = {};
        if (filter) {
            if (filter.search) {
                where.OR = [
                    { name: { contains: filter.search, mode: 'insensitive' } },
                    { display_name: { contains: filter.search, mode: 'insensitive' } },
                ];
            }
            if (filter.published !== undefined && filter.published !== null) {
                where.published = filter.published;
            }
        }

        // Total record count (filtered)
        const totalCount = await prisma.dogmaAttribute.count({ where });
        const totalPages = Math.ceil(totalCount / take);

        // Fetch data - alphabetic sorting by name
        const dogmaAttributes = await prisma.dogmaAttribute.findMany({
            where,
            skip,
            take,
            orderBy: { name: 'asc' },
        });

        const pageInfo: PageInfo = {
            currentPage,
            totalPages,
            totalCount,
            hasNextPage: currentPage < totalPages,
            hasPreviousPage: currentPage > 1,
        };

        return {
            edges: dogmaAttributes.map((attr: any, index: number) => ({
                node: {
                    ...attr,
                    created_at: attr.created_at.toISOString(),
                    updated_at: attr.updated_at.toISOString(),
                },
                cursor: Buffer.from(`${skip + index}`).toString('base64'),
            })),
            pageInfo,
        };
    },
};

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
