import axios from 'axios';
import { MutationResolvers, PageInfo, QueryResolvers, RegionResolvers } from '../generated-types';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

export const regionQueries: QueryResolvers = {
    region: async (_, { id }) => {
        const region = await prisma.region.findUnique({
            where: { id: Number(id) },
        });
        return region as any;
    }, regions: async (_, { filter }) => {
        const take = filter?.limit ?? 25;
        const currentPage = filter?.page ?? 1;
        const skip = (currentPage - 1) * take;

        // Filter koşullarını oluştur
        const where: any = {};
        if (filter) {
            if (filter.search) {
                where.name = { contains: filter.search, mode: 'insensitive' };
            }
            if (filter.name) {
                where.name = { contains: filter.name, mode: 'insensitive' };
            }
        }

        // Total record count (filtered)
        const totalCount = await prisma.region.count({ where });
        const totalPages = Math.ceil(totalCount / take);

        // OrderBy logic
        let orderBy: any = { name: 'asc' }; // default
        if (filter?.orderBy) {
            switch (filter.orderBy) {
                case 'nameAsc':
                    orderBy = { name: 'asc' };
                    break;
                case 'nameDesc':
                    orderBy = { name: 'desc' };
                    break;
                default:
                    orderBy = { name: 'asc' };
            }
        }

        // Fetch data
        const regions = await prisma.region.findMany({
            where,
            skip,
            take,
            orderBy,
        });

        const pageInfo: PageInfo = {
            currentPage,
            totalPages,
            totalCount,
            hasNextPage: currentPage < totalPages,
            hasPreviousPage: currentPage > 1,
        };

        return {
            edges: regions.map((r: any, index: number) => ({
                node: r,
                cursor: Buffer.from(`${skip + index}`).toString('base64'),
            })),
            pageInfo,
        };
    },
};

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
            const QUEUE_NAME = 'esi_all_regions_queue';

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

export const regionFieldResolvers: RegionResolvers = {
    constellations: async (parent, _, context) => {
        if (!parent.id) return [];
        return context.loaders.constellationsByRegion.load(parent.id);
    },
};
