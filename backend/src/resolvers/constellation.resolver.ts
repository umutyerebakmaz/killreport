import axios from 'axios';
import { ConstellationResolvers, MutationResolvers, PageInfo, QueryResolvers } from '../generated-types';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

export const constellationQueries: QueryResolvers = {
  constellation: async (_, { id }) => {
    const constellation = await prisma.constellation.findUnique({
      where: { id: Number(id) },
    });
    return constellation as any;
  },

  constellations: async (_, { filter }) => {
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
      if (filter.region_id) {
        where.region_id = filter.region_id;
      }
    }

    // Total record count (filtered)
    const totalCount = await prisma.constellation.count({ where });
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
    const constellations = await prisma.constellation.findMany({
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
      edges: constellations.map((c: any, index: number) => ({
        node: c,
        cursor: Buffer.from(`${skip + index}`).toString('base64'),
      })),
      pageInfo,
    };
  },
};

export const constellationMutations: MutationResolvers = {
  startConstellationSync: async (_, { input }) => {
    try {
      console.log('🚀 Starting constellation sync via GraphQL...');

      // Get all constellation IDs from ESI
      const response = await axios.get('https://esi.evetech.net/latest/universe/constellations/');
      const constellationIds: number[] = response.data;

      console.log(`✓ Found ${constellationIds.length} constellations`);
      console.log(`📤 Publishing to queue...`);

      // RabbitMQ'ya ekle
      const channel = await getRabbitMQChannel();
      const QUEUE_NAME = 'esi_all_constellations_queue';

      await channel.assertQueue(QUEUE_NAME, {
        durable: true,
      });

      let publishedCount = 0;
      for (const id of constellationIds) {
        channel.sendToQueue(QUEUE_NAME, Buffer.from(id.toString()), {
          persistent: true,
        });
        publishedCount++;
      }

      console.log(`✅ All ${constellationIds.length} constellations queued successfully!`);
      return {
        success: true,
        message: `${constellationIds.length} constellations queued successfully`,
        clientMutationId: input.clientMutationId || null,
      };
    } catch (error) {
      console.error('❌ Error starting constellation sync:', error);
      return {
        success: false,
        message: 'Failed to start constellation sync',
        clientMutationId: input.clientMutationId || null,
      };
    }
  },
};

export const constellationFieldResolvers: ConstellationResolvers = {
  position: (parent) => {
    // parent is from Prisma, has position_x, position_y, position_z
    const prismaParent = parent as any;
    if (prismaParent.position_x === null || prismaParent.position_y === null || prismaParent.position_z === null) {
      return null;
    }
    return {
      x: prismaParent.position_x,
      y: prismaParent.position_y,
      z: prismaParent.position_z,
    };
  },
  region: async (parent: any, _: any, context: any) => {
    const prismaParent = parent as any;
    if (!prismaParent.region_id) return null;
    return context.loaders.region.load(prismaParent.region_id);
  },
  solarSystems: async (parent: any, _: any, context: any) => {
    if (!parent.id) return [];
    return context.loaders.solarSystemsByConstellation.load(parent.id);
  },
};
