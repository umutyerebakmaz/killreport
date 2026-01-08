import axios from 'axios';
import { MutationResolvers, PageInfo, QueryResolvers, RegionResolvers, SecurityStats } from '../generated-types';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

// Helper function to calculate security stats from solar systems
async function calculateSecurityStats(solarSystems: { security_status: number | null }[]): Promise<SecurityStats> {
    let highSec = 0;
    let lowSec = 0;
    let nullSec = 0;
    let wormhole = 0;
    let totalSecurity = 0;
    let validSecurityCount = 0;

    for (const system of solarSystems) {
        const sec = system.security_status;
        if (sec === null) {
            wormhole++;
            continue;
        }
        totalSecurity += sec;
        validSecurityCount++;
        if (sec >= 0.5) {
            highSec++;
        } else if (sec > 0.0) {
            lowSec++;
        } else {
            nullSec++;
        }
    }

    return {
        highSec,
        lowSec,
        nullSec,
        wormhole,
        avgSecurity: validSecurityCount > 0 ? totalSecurity / validSecurityCount : null,
    };
}

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
            const QUEUE_NAME = 'esi_regions_queue';

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
    constellationCount: async (parent) => {
        if (!parent.id) return 0;
        return prisma.constellation.count({
            where: { region_id: parent.id },
        });
    },
    solarSystemCount: async (parent) => {
        if (!parent.id) return 0;
        const constellations = await prisma.constellation.findMany({
            where: { region_id: parent.id },
            select: { id: true },
        });
        const constellationIds = constellations.map(c => c.id);
        return prisma.solarSystem.count({
            where: { constellation_id: { in: constellationIds } },
        });
    },
    securityStats: async (parent) => {
        if (!parent.id) return { highSec: 0, lowSec: 0, nullSec: 0, wormhole: 0, avgSecurity: null };
        const constellations = await prisma.constellation.findMany({
            where: { region_id: parent.id },
            select: { id: true },
        });
        const constellationIds = constellations.map(c => c.id);
        const solarSystems = await prisma.solarSystem.findMany({
            where: { constellation_id: { in: constellationIds } },
            select: { security_status: true },
        });
        return calculateSecurityStats(solarSystems);
    },
};
