import { CategoryResolvers, MutationResolvers, PageInfo, QueryResolvers } from '../generated-types';
import { CategoryService } from '../services/category';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';
import redis from '../services/redis';

export const categoryQueries: QueryResolvers = {
    category: async (_, { id }) => {
        const cacheKey = `category:detail:${id}`;

        // Check cache first
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }

        const category = await prisma.category.findUnique({
            where: { id: Number(id) },
        });
        if (!category) return null;

        const result = {
            ...category,
            created_at: category.created_at.toISOString(),
            updated_at: category.updated_at.toISOString(),
        } as any;

        // Cache for 24 hours (category data rarely changes)
        await redis.setex(cacheKey, 86400, JSON.stringify(result));
        return result;
    },

    categories: async (_, { filter }) => {
        const take = filter?.limit ?? 25;
        const currentPage = filter?.page ?? 1;
        const skip = (currentPage - 1) * take;

        // Filter koşullarını oluştur
        const where: any = {};
        if (filter) {
            if (filter.search) {
                where.name = { contains: filter.search, mode: 'insensitive' };
            }
            if (filter.published !== undefined && filter.published !== null) {
                where.published = filter.published;
            }
        }

        // Total record count (filtered)
        const totalCount = await prisma.category.count({ where });
        const totalPages = Math.ceil(totalCount / take);

        // Fetch data - alfabetik sıralama
        const categories = await prisma.category.findMany({
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
            edges: categories.map((c: any, index: number) => ({
                node: {
                    ...c,
                    created_at: c.created_at.toISOString(),
                    updated_at: c.updated_at.toISOString(),
                },
                cursor: Buffer.from(`${skip + index}`).toString('base64'),
            })),
            pageInfo,
        };
    },
};

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

/**
 * Field Resolvers - ItemGroup ilişkisi için DataLoader kullanımı
 */
export const categoryFieldResolvers: CategoryResolvers = {
    groups: async (parent, _, context) => {
        // DataLoader ile N+1 problem'ini çöz
        const groups = await context.loaders.itemGroupsByCategory.load(parent.id);

        return groups.map((g: any) => ({
            ...g,
            created_at: g.created_at.toISOString(),
            updated_at: g.updated_at.toISOString(),
        }));
    },
};
