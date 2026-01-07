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

  startTypeDogmaSync: async (_, { input }) => {
    try {
      logger.info('🚀 Starting type dogma sync via GraphQL...');

      const channel = await getRabbitMQChannel();
      const QUEUE_NAME = 'esi_type_dogma_queue';

      await channel.assertQueue(QUEUE_NAME, {
        durable: true,
        arguments: { 'x-max-priority': 10 },
      });

      let typeIds: number[];

      // If specific type IDs provided, use them; otherwise get all types from DB
      if (input.typeIds && input.typeIds.length > 0) {
        typeIds = input.typeIds.map(id => Number(id));
        logger.info(`✓ Using ${typeIds.length} specified type IDs`);
      } else {
        const types = await prisma.type.findMany({
          select: { id: true },
        });
        typeIds = types.map(t => t.id);
        logger.info(`✓ Found ${typeIds.length} types in database`);
      }

      logger.info(`📤 Publishing to queue...`);

      let publishedCount = 0;
      for (const id of typeIds) {
        const message = {
          entityId: id,
          queuedAt: new Date().toISOString(),
          source: 'startTypeDogmaSync',
        };
        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
          persistent: true,
        });
        publishedCount++;
      }

      logger.info(`✅ Queued ${publishedCount} types for dogma sync`);

      return {
        success: true,
        message: `Successfully queued ${publishedCount} types for dogma sync`,
        queuedCount: publishedCount,
        clientMutationId: input.clientMutationId,
      };
    } catch (error) {
      logger.error('❌ Error starting type dogma sync:', error);
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        queuedCount: 0,
        clientMutationId: input.clientMutationId,
      };
    }
  },
};

export const typeFieldResolvers: TypeResolvers = {
  group: async (parent, _, context) => {
    // Cast to any to access Prisma model fields
    const prismaType = parent as any;
    if (!prismaType.group_id) return null;
    const group = await context.loaders.itemGroup.load(prismaType.group_id);
    if (!group) return null;

    return {
      ...group,
      created_at: group.created_at.toISOString(),
      updated_at: group.updated_at.toISOString(),
    } as any;
  },

  dogmaAttributes: async (parent, _, context) => {
    const prismaType = parent as any;
    const attributes = await context.loaders.typeDogmaAttributes.load(prismaType.id);

    return attributes.map((attr: any) => ({
      type_id: attr.type_id,
      attribute_id: attr.attribute_id,
      value: attr.value,
      attribute: {
        id: attr.attribute.id,
        name: attr.attribute.name,
        display_name: attr.attribute.display_name,
        description: attr.attribute.description,
        unit_id: attr.attribute.unit_id,
        icon_id: attr.attribute.icon_id,
        default_value: attr.attribute.default_value,
        published: attr.attribute.published,
        stackable: attr.attribute.stackable,
        high_is_good: attr.attribute.high_is_good,
        created_at: attr.attribute.created_at.toISOString(),
        updated_at: attr.attribute.updated_at.toISOString(),
      },
    }));
  },

  dogmaEffects: async (parent, _, context) => {
    const prismaType = parent as any;
    const effects = await context.loaders.typeDogmaEffects.load(prismaType.id);

    return effects.map((eff: any) => ({
      type_id: eff.type_id,
      effect_id: eff.effect_id,
      is_default: eff.is_default,
      effect: {
        id: eff.effect.id,
        name: eff.effect.name,
        display_name: eff.effect.display_name,
        description: eff.effect.description,
        effect_category: eff.effect.effect_category,
        pre_expression: eff.effect.pre_expression,
        post_expression: eff.effect.post_expression,
        icon_id: eff.effect.icon_id,
        published: eff.effect.published,
        is_offensive: eff.effect.is_offensive,
        is_assistance: eff.effect.is_assistance,
        disallow_auto_repeat: eff.effect.disallow_auto_repeat,
        created_at: eff.effect.created_at.toISOString(),
        updated_at: eff.effect.updated_at.toISOString(),
      },
    }));
  },
};
