import { ItemGroupResolvers, MutationResolvers, PageInfo, QueryResolvers } from '@generated-types';
import { ItemGroupService } from '../services/item-group';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';
import redis from '../services/redis';

/**
 * ItemGroup Query Resolvers
 * Handles fetching item group data and listing item groups with filters
 */
export const itemGroupQueries: QueryResolvers = {
    itemGroup: async (_, { id }) => {
        const cacheKey = `itemGroup:detail:${id}`;

        // Check cache first
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }

        const itemGroup = await prisma.itemGroup.findUnique({
            where: { id: Number(id) },
        });
        if (!itemGroup) return null;

        const result = {
            ...itemGroup,
            created_at: itemGroup.created_at.toISOString(),
            updated_at: itemGroup.updated_at.toISOString(),
        } as any;

        // Cache for 24 hours (item group data rarely changes)
        await redis.setex(cacheKey, 86400, JSON.stringify(result));
        return result;
    },

    itemGroups: async (_, { filter }) => {
        const take = filter?.limit ?? 25;
        const currentPage = filter?.page ?? 1;
        const skip = (currentPage - 1) * take;

        // Filter koşullarını oluştur
        const where: any = {};
        if (filter) {
            if (filter.search) {
                where.name = { contains: filter.search, mode: 'insensitive' };
            }
            if (filter.category_id !== undefined && filter.category_id !== null) {
                where.category_id = filter.category_id;
            }
            if (filter.published !== undefined && filter.published !== null) {
                where.published = filter.published;
            }
        }

        // Total record count (filtered)
        const totalCount = await prisma.itemGroup.count({ where });
        const totalPages = Math.ceil(totalCount / take);

        // Fetch data - alfabetik sıralama
        const itemGroups = await prisma.itemGroup.findMany({
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
            edges: itemGroups.map((g: any, index: number) => ({
                node: {
                    ...g,
                    created_at: g.created_at.toISOString(),
                    updated_at: g.updated_at.toISOString(),
                },
                cursor: Buffer.from(`${skip + index}`).toString('base64'),
            })),
            pageInfo,
        };
    },
};

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

/**
 * ItemGroup Field Resolvers
 * Handles nested fields and computed properties for ItemGroup
 * Uses DataLoaders to prevent N+1 queries
 */
export const itemGroupFieldResolvers: ItemGroupResolvers = {
    category: async (parent, _, context) => {
        // Cast to any to access Prisma model fields
        const prismaGroup = parent as any;
        // DataLoader ile N+1 problem'ini çöz
        const category = await context.loaders.category.load(prismaGroup.category_id);
        if (!category) return null;

        return {
            ...category,
            created_at: category.created_at.toISOString(),
            updated_at: category.updated_at.toISOString(),
        } as any;
    },

    types: async (parent) => {
        const types = await prisma.type.findMany({
            where: { group_id: parent.id },
            orderBy: { name: 'asc' },
        });

        return types.map((t: any) => ({
            ...t,
            created_at: t.created_at.toISOString(),
            updated_at: t.updated_at.toISOString(),
        }));
    },
};
