import { MutationResolvers, PageInfo, QueryResolvers } from '../generated-types';
import { DogmaEffectService } from '../services/dogma';
import logger from '../services/logger';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';
import redis from '../services/redis';

export const dogmaEffectQueries: QueryResolvers = {
    dogmaEffect: async (_, { id }) => {
        const cacheKey = `dogma-effect:detail:${id}`;

        // Check cache first
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }

        const dogmaEffect = await prisma.dogmaEffect.findUnique({
            where: { id: Number(id) },
        });
        if (!dogmaEffect) return null;

        const result = {
            ...dogmaEffect,
            created_at: dogmaEffect.created_at.toISOString(),
            updated_at: dogmaEffect.updated_at.toISOString(),
        } as any;

        // Cache for 24 hours (dogma data rarely changes)
        await redis.setex(cacheKey, 86400, JSON.stringify(result));
        return result;
    },

    dogmaEffects: async (_, { filter }) => {
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
            if (filter.effect_category !== undefined && filter.effect_category !== null) {
                where.effect_category = filter.effect_category;
            }
        }

        // Total record count (filtered)
        const totalCount = await prisma.dogmaEffect.count({ where });
        const totalPages = Math.ceil(totalCount / take);

        // Fetch data - alphabetic sorting by name
        const dogmaEffects = await prisma.dogmaEffect.findMany({
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
            edges: dogmaEffects.map((effect: any, index: number) => ({
                node: {
                    ...effect,
                    created_at: effect.created_at.toISOString(),
                    updated_at: effect.updated_at.toISOString(),
                },
                cursor: Buffer.from(`${skip + index}`).toString('base64'),
            })),
            pageInfo,
        };
    },
};

export const dogmaEffectMutations: MutationResolvers = {
    startDogmaEffectSync: async (_, { input }) => {
        try {
            logger.info('🚀 Starting dogma effect sync via GraphQL...');

            // Get all dogma effect IDs from ESI
            const effectIds = await DogmaEffectService.getAllEffectIds();

            logger.info(`✓ Found ${effectIds.length} dogma effects`);
            logger.info(`📤 Publishing to queue...`);

            // Add to RabbitMQ queue
            const channel = await getRabbitMQChannel();
            const QUEUE_NAME = 'esi_dogma_effect_info_queue';

            await channel.assertQueue(QUEUE_NAME, {
                durable: true,
                arguments: { 'x-max-priority': 10 },
            });

            // Queue all effect IDs
            for (const effectId of effectIds) {
                const message = {
                    entityId: effectId,
                    queuedAt: new Date().toISOString(),
                    source: 'graphql-mutation',
                };

                channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
                    persistent: true,
                });
            }

            logger.info(`✓ Queued ${effectIds.length} dogma effects`);
            logger.info(`📊 Run worker with: yarn worker:info:dogma-effects`);

            return {
                success: true,
                message: `Successfully queued ${effectIds.length} dogma effects for sync`,
                clientMutationId: input.clientMutationId,
            };
        } catch (error: any) {
            logger.error('Failed to start dogma effect sync', { error: error.message });
            return {
                success: false,
                message: `Failed to start sync: ${error.message}`,
                clientMutationId: input.clientMutationId,
            };
        }
    },
};
