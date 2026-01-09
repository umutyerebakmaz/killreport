import axios from 'axios';
import { AllianceResolvers, MutationResolvers, PageInfo, QueryResolvers } from '../generated-types';
import logger from '../services/logger';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';
import redis from '../services/redis';

/**
 * Alliance Query Resolvers
 * Handles fetching alliance data and listing alliances with filters
 */
export const allianceQueries: QueryResolvers = {
  alliance: async (_, { id }) => {
    const cacheKey = `alliance:detail:${id}`;

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const alliance = await prisma.alliance.findUnique({
      where: { id: Number(id) },
    });
    if (!alliance) return null;

    // Field resolver'lar eksik field'ları otomatik doldurur
    const result = {
      ...alliance,
      date_founded: alliance.date_founded.toISOString(),
    } as any;

    // Cache for 30 minutes (alliance info updates occasionally)
    await redis.setex(cacheKey, 1800, JSON.stringify(result));
    return result;
  },

  alliances: async (_, { filter }) => {
    const take = filter?.limit ?? 25;
    const currentPage = filter?.page ?? 1;
    const skip = (currentPage - 1) * take;

    // Filter koşullarını oluştur
    const where: any = {};
    if (filter) {
      if (filter.search) {
        where.OR = [
          { name: { contains: filter.search, mode: 'insensitive' } },
          { ticker: { contains: filter.search, mode: 'insensitive' } },
        ];
      }
      if (filter.name) {
        where.name = { contains: filter.name, mode: 'insensitive' };
      }
      if (filter.ticker) {
        where.ticker = { contains: filter.ticker, mode: 'insensitive' };
      }
      if (filter.dateFoundedFrom || filter.dateFoundedTo) {
        where.date_founded = {};
        if (filter.dateFoundedFrom) {
          where.date_founded.gte = new Date(filter.dateFoundedFrom);
        }
        if (filter.dateFoundedTo) {
          where.date_founded.lte = new Date(filter.dateFoundedTo);
        }
      }
    }

    // Total record count (filtered)
    const totalCount = await prisma.alliance.count({ where });
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
        case 'memberCountAsc':
          orderBy = { member_count: 'asc' };
          break;
        case 'memberCountDesc':
          orderBy = { member_count: 'desc' };
          break;
        default:
          orderBy = { name: 'asc' };
      }
    }

    // Fetch data
    const alliances = await prisma.alliance.findMany({
      where,
      skip,
      take,
      orderBy,
      select: {
        id: true,
        name: true,
        ticker: true,
        date_founded: true,
        executor_corporation_id: true,
        creator_id: true,
        creator_corporation_id: true,
        faction_id: true,
        // Hesaplanmış field'ları seç
        member_count: true,
        corporation_count: true,
      },
    });

    const pageInfo: PageInfo = {
      currentPage,
      totalPages,
      totalCount,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    };

    return {
      edges: alliances.map((a: any, index: number) => ({
        node: {
          ...a,
          date_founded: a.date_founded.toISOString(),
          // Field resolver'lar metrics gibi computed field'ları otomatik doldurur
        },
        cursor: Buffer.from(`${skip + index}`).toString('base64'),
      })),
      pageInfo,
    };
  },
};

/**
 * Alliance Mutation Resolvers
 * Handles operations that modify alliance data
 */
export const allianceMutations: MutationResolvers = {
  startAllianceSync: async (_, { input }) => {
    try {
      logger.info('🚀 Starting alliance sync via GraphQL...');

      // Get all alliance IDs from ESI
      const response = await axios.get('https://esi.evetech.net/latest/alliances/');
      const allianceIds: number[] = response.data;

      logger.info(`✓ Found ${allianceIds.length} alliances`);
      logger.info(`📤 Publishing to queue...`);            // RabbitMQ'ya ekle
      const channel = await getRabbitMQChannel();
      const QUEUE_NAME = 'alliance_queue';

      let publishedCount = 0;
      for (const id of allianceIds) {
        channel.sendToQueue(QUEUE_NAME, Buffer.from(id.toString()), {
          persistent: true,
        });
        publishedCount++;

        // Her 100 alliance'da bir log
        if (publishedCount % 100 === 0) {
          logger.debug(`  ✓ Published ${publishedCount}/${allianceIds.length}`);
        }
      }

      logger.info(`✅ All ${allianceIds.length} alliances queued successfully!`);
      return {
        success: true,
        message: `${allianceIds.length} alliances queued successfully`,
        clientMutationId: input.clientMutationId || null,
      };
    } catch (error) {
      logger.error('❌ Error starting alliance sync:', error);
      return {
        success: false,
        message: 'Failed to start alliance sync',
        clientMutationId: input.clientMutationId || null,
      };
    }
  },
};

/**
 * Alliance Field Resolvers
 * Handles nested fields and computed properties for Alliance type
 * Uses DataLoaders to prevent N+1 queries
 */
export const allianceFieldResolvers: AllianceResolvers = {
  executor: async (parent, _args, context) => {
    // Cast to any to access Prisma model fields
    const prismaAlliance = parent as any;
    // DataLoader kullanarak executor corporation'ı getir
    const corporation = await context.loaders.corporation.load(prismaAlliance.executor_corporation_id);

    if (!corporation) return null;

    return {
      ...corporation,
      date_founded: corporation.date_founded?.toISOString() || null,
    };
  },

  createdByCorporation: async (parent, _args, context) => {
    // Cast to any to access Prisma model fields
    const prismaAlliance = parent as any;
    // DataLoader kullanarak executor corporation'ı getir
    const corporation = await context.loaders.corporation.load(prismaAlliance.creator_corporation_id);

    if (!corporation) return null;

    return {
      ...corporation,
      date_founded: corporation.date_founded?.toISOString() || null,
    };
  },

  createdBy: async (parent, _args, context) => {
    // Cast to any to access Prisma model fields
    const prismaAlliance = parent as any;
    // DataLoader kullanarak executor corporation'ı getir
    const character = await context.loaders.character.load(prismaAlliance.creator_id);

    if (!character) return null;

    return {
      ...character,
      date_founded: character.date_founded?.toISOString() || null,
    };
  },


  corporations: async (parent, _args, context) => {
    // DataLoader kullan - N+1 problem çözümü
    const corporations = await context.loaders.corporationsByAlliance.load(parent.id);

    // Client-side sorting (database'den batch query aldık)
    const sorted = [...corporations].sort((a, b) => b.member_count - a.member_count);

    return sorted.map((corp: any) => ({
      ...corp,
      date_founded: corp.date_founded?.toISOString() || null,
      alliance: null, // Circular reference'ı önlemek için null
    }));
  },

  corporationCount: async (parent, _args, context) => {
    // Önce parent'ta varsa kullan (DB'den gelmiş olabilir)
    const prismaAlliance = parent as any;
    if (prismaAlliance.corporation_count !== undefined && prismaAlliance.corporation_count !== null) {
      return prismaAlliance.corporation_count;
    }

    // Yoksa DataLoader kullan - N+1 problem çözümü
    const corporations = await context.loaders.corporationsByAlliance.load(parent.id);
    return corporations.length;
  },

  memberCount: async (parent, _args, context) => {
    // Önce parent'ta varsa kullan (DB'den gelmiş olabilir)
    const prismaAlliance = parent as any;
    if (prismaAlliance.member_count !== undefined && prismaAlliance.member_count !== null) {
      return prismaAlliance.member_count;
    }

    // Yoksa DataLoader kullan - N+1 problem çözümü
    const corporations = await context.loaders.corporationsByAlliance.load(parent.id);
    return corporations.reduce((sum: number, corp: any) => {
      const memberCount = corp.member_count ?? 0;
      return sum + memberCount;
    }, 0);
  },

  metrics: async (parent, _args, context) => {
    const now = new Date();
    const date1d = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const date7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const date30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Mevcut değerleri al - eğer parent'ta varsa kullan, yoksa hesapla
    // Bu sayede aynı query'de hem memberCount hem metrics istenirse tek hesaplama yapılır
    // Not: Prisma'dan gelen data snake_case kullanıyor (member_count, corporation_count)
    let currentMemberCount = (parent as any).member_count;
    let currentCorpCount = (parent as any).corporation_count;

    // Eğer parent'ta member_count veya corporation_count yoksa, hesapla
    if ((currentMemberCount === undefined || currentMemberCount === null) ||
      (currentCorpCount === undefined || currentCorpCount === null)) {
      // Parent'ta yoksa hesapla
      const [corpCount, memberResult] = await Promise.all([
        prisma.corporation.count({
          where: { alliance_id: parent.id },
        }),
        prisma.corporation.aggregate({
          where: { alliance_id: parent.id },
          _sum: { member_count: true },
        }),
      ]);
      currentCorpCount = corpCount;
      currentMemberCount = memberResult._sum.member_count || 0;
    }

    // Use DataLoader to batch snapshot queries
    const [snapshot1d, snapshot7d, snapshot30d] = await Promise.all([
      context.loaders.allianceSnapshot.load({ allianceId: parent.id, date: date1d }),
      context.loaders.allianceSnapshot.load({ allianceId: parent.id, date: date7d }),
      context.loaders.allianceSnapshot.load({ allianceId: parent.id, date: date30d }),
    ]);

    // Delta hesaplamaları
    const memberCountDelta1d = snapshot1d
      ? currentMemberCount - snapshot1d.member_count
      : null;
    const memberCountDelta7d = snapshot7d
      ? currentMemberCount - snapshot7d.member_count
      : null;
    const memberCountDelta30d = snapshot30d
      ? currentMemberCount - snapshot30d.member_count
      : null;
    const corporationCountDelta1d = snapshot1d
      ? currentCorpCount - snapshot1d.corporation_count
      : null;
    const corporationCountDelta7d = snapshot7d
      ? currentCorpCount - snapshot7d.corporation_count
      : null;
    const corporationCountDelta30d = snapshot30d
      ? currentCorpCount - snapshot30d.corporation_count
      : null;

    // Growth rate hesaplamaları (yüzde)
    const memberCountGrowthRate1d = snapshot1d && snapshot1d.member_count > 0
      ? ((currentMemberCount - snapshot1d.member_count) / snapshot1d.member_count) * 100
      : null;
    const memberCountGrowthRate7d = snapshot7d && snapshot7d.member_count > 0
      ? ((currentMemberCount - snapshot7d.member_count) / snapshot7d.member_count) * 100
      : null;
    const memberCountGrowthRate30d = snapshot30d && snapshot30d.member_count > 0
      ? ((currentMemberCount - snapshot30d.member_count) / snapshot30d.member_count) * 100
      : null;
    const corporationCountGrowthRate1d = snapshot1d && snapshot1d.corporation_count > 0
      ? ((currentCorpCount - snapshot1d.corporation_count) / snapshot1d.corporation_count) * 100
      : null;
    const corporationCountGrowthRate7d = snapshot7d && snapshot7d.corporation_count > 0
      ? ((currentCorpCount - snapshot7d.corporation_count) / snapshot7d.corporation_count) * 100
      : null;
    const corporationCountGrowthRate30d = snapshot30d && snapshot30d.corporation_count > 0
      ? ((currentCorpCount - snapshot30d.corporation_count) / snapshot30d.corporation_count) * 100
      : null;

    return {
      memberCountDelta1d,
      memberCountDelta7d,
      memberCountDelta30d,
      corporationCountDelta1d,
      corporationCountDelta7d,
      corporationCountDelta30d,
      memberCountGrowthRate1d,
      memberCountGrowthRate7d,
      memberCountGrowthRate30d,
      corporationCountGrowthRate1d,
      corporationCountGrowthRate7d,
      corporationCountGrowthRate30d,
    };
  },

  snapshots: async (parent, args) => {
    const days = args.days ?? 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const snapshots = await prisma.allianceSnapshot.findMany({
      where: {
        alliance_id: parent.id,
        snapshot_date: { gte: since },
      },
      orderBy: { snapshot_date: 'asc' },
    });

    return snapshots.map((s: any) => ({
      date: s.snapshot_date.toISOString().split('T')[0], // YYYY-MM-DD formatında
      memberCount: s.member_count,
      corporationCount: s.corporation_count,
    }));
  },
};
