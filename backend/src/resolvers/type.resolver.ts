import { MutationResolvers, PageInfo, QueryResolvers, TypeResolvers } from '../generated-types';
import logger from '../services/logger';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';
import redis from '../services/redis';
import { TypeService } from '../services/type';

export const typeQueries: QueryResolvers = {
    type: async (_, { id }) => {
        const cacheKey = `type:detail:${id}`;

        // Check cache first
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }

        const type = await prisma.type.findUnique({
            where: { id: Number(id) },
        });
        if (!type) return null;

        const result = {
            ...type,
            created_at: type.created_at.toISOString(),
            updated_at: type.updated_at.toISOString(),
        } as any;

        // Cache for 24 hours (type data rarely changes)
        await redis.setex(cacheKey, 86400, JSON.stringify(result));
        return result;
    },

    types: async (_, { filter }) => {
        const take = filter?.limit ?? 25;
        const currentPage = filter?.page ?? 1;
        const skip = (currentPage - 1) * take;

        // Filter koşullarını oluştur
        const where: any = {};
        if (filter) {
            if (filter.search) {
                where.name = { contains: filter.search, mode: 'insensitive' };
            }
            if (filter.group_id !== undefined && filter.group_id !== null) {
                where.group_id = filter.group_id;
            }
            if (filter.published !== undefined && filter.published !== null) {
                where.published = filter.published;
            }
        }

        // Total record count (filtered)
        const totalCount = await prisma.type.count({ where });
        const totalPages = Math.ceil(totalCount / take);

        // Fetch data - alfabetik sıralama
        const types = await prisma.type.findMany({
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
            edges: types.map((t: any, index: number) => ({
                node: {
                    ...t,
                    created_at: t.created_at.toISOString(),
                    updated_at: t.updated_at.toISOString(),
                },
                cursor: Buffer.from(`${skip + index}`).toString('base64'),
            })),
            pageInfo,
        };
    },
};

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
};

export const typeFieldResolvers: TypeResolvers = {
    group: async (parent, _, context) => {
        if (!parent.group_id) return null;
        const group = await context.loaders.itemGroup.load(parent.group_id);
        if (!group) return null;

        return {
            ...group,
            created_at: group.created_at.toISOString(),
            updated_at: group.updated_at.toISOString(),
        } as any;
    },
};
