import axios from 'axios';
import { AllianceResolvers, MutationResolvers, PageInfo, QueryResolvers } from '../generated-types';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

export const allianceQueries: QueryResolvers = {
  alliance: async (_, { id }) => {
    const alliance = await prisma.alliance.findUnique({
      where: { id: Number(id) },
    });
    if (!alliance) return null;

    // Field resolver'lar eksik field'ları otomatik doldurur
    return {
      ...alliance,
      date_founded: alliance.date_founded.toISOString(),
    } as any;
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
    }

    // Total record count (filtered)
    const totalCount = await prisma.alliance.count({ where });
    const totalPages = Math.ceil(totalCount / take);

    // Fetch data
    const alliances = await prisma.alliance.findMany({
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
      edges: alliances.map((a: any, index: number) => ({
        node: {
          ...a,
          date_founded: a.date_founded.toISOString(),
          // Field resolver'lar eksik field'ları otomatik doldurur
        },
        cursor: Buffer.from(`${skip + index}`).toString('base64'),
      })),
      pageInfo,
    };
  },
};

export const allianceMutations: MutationResolvers = {
  startAllianceSync: async (_, { input }) => {
    try {
      console.log('🚀 Starting alliance sync via GraphQL...');

      // Get all alliance IDs from ESI
      const response = await axios.get('https://esi.evetech.net/latest/alliances/');
      const allianceIds: number[] = response.data;

      console.log(`✓ Found ${allianceIds.length} alliances`);
      console.log(`📤 Publishing to queue...`);            // RabbitMQ'ya ekle
      const channel = await getRabbitMQChannel();
      const QUEUE_NAME = 'alliance_sync_queue';

      let publishedCount = 0;
      for (const id of allianceIds) {
        channel.sendToQueue(QUEUE_NAME, Buffer.from(id.toString()), {
          persistent: true,
        });
        publishedCount++;

        // Her 100 alliance'da bir log
        if (publishedCount % 100 === 0) {
          console.log(`  ✓ Published ${publishedCount}/${allianceIds.length}`);
        }
      }

      console.log(`✅ All ${allianceIds.length} alliances queued successfully!`);
      return {
        success: true,
        message: `${allianceIds.length} alliances queued successfully`,
        clientMutationId: input.clientMutationId || null,
      };
    } catch (error) {
      console.error('❌ Error starting alliance sync:', error);
      return {
        success: false,
        message: 'Failed to start alliance sync',
        clientMutationId: input.clientMutationId || null,
      };
    }
  },
};

/**
 * Field Resolvers - Nested fields için lazy loading + DataLoader
 * Corporations bilgisi sadece query'de istenirse çekilir
 * DataLoader ile batch loading - N+1 problem çözümü
 */
export const allianceFieldResolvers: AllianceResolvers = {
  corporations: async (parent, _args, context) => {
    // DataLoader kullan - otomatik batch yapacak
    const corporations = await context.loaders.corporationsByAlliance.load(parent.id);

    return corporations.map((corp: any) => ({
      ...corp,
      date_founded: corp.date_founded?.toISOString() || null,
      alliance: null, // Circular reference'ı önlemek için null
    }));
  },

  corporationCount: async (parent) => {
    // Alliance'a ait corporation sayısı
    return await prisma.corporation.count({
      where: { alliance_id: parent.id },
    });
  },

  memberCount: async (parent) => {
    // Alliance'daki tüm corporation'ların toplam üye sayısı
    const result = await prisma.corporation.aggregate({
      where: { alliance_id: parent.id },
      _sum: {
        member_count: true,
      },
    });
    return result._sum.member_count || 0;
  },

  metrics: async (parent) => {
    const now = new Date();
    const date7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const date30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Mevcut değerleri al - eğer parent'ta varsa kullan, yoksa hesapla
    // Bu sayede aynı query'de hem memberCount hem metrics istenirse tek hesaplama yapılır
    let currentMemberCount = (parent as any).memberCount;
    let currentCorpCount = (parent as any).corporationCount;

    if (!currentMemberCount || !currentCorpCount) {
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

    // 7 gün önceki snapshot
    const snapshot7d = await prisma.allianceSnapshot.findFirst({
      where: {
        alliance_id: parent.id,
        snapshot_date: { lte: date7d },
      },
      orderBy: { snapshot_date: 'desc' },
    });

    // 30 gün önceki snapshot
    const snapshot30d = await prisma.allianceSnapshot.findFirst({
      where: {
        alliance_id: parent.id,
        snapshot_date: { lte: date30d },
      },
      orderBy: { snapshot_date: 'desc' },
    });

    // Delta hesaplamaları
    const memberCountDelta7d = snapshot7d
      ? currentMemberCount - snapshot7d.member_count
      : null;
    const memberCountDelta30d = snapshot30d
      ? currentMemberCount - snapshot30d.member_count
      : null;
    const corporationCountDelta7d = snapshot7d
      ? currentCorpCount - snapshot7d.corporation_count
      : null;
    const corporationCountDelta30d = snapshot30d
      ? currentCorpCount - snapshot30d.corporation_count
      : null;

    // Growth rate hesaplamaları (yüzde)
    const memberCountGrowthRate7d = snapshot7d && snapshot7d.member_count > 0
      ? ((currentMemberCount - snapshot7d.member_count) / snapshot7d.member_count) * 100
      : null;
    const memberCountGrowthRate30d = snapshot30d && snapshot30d.member_count > 0
      ? ((currentMemberCount - snapshot30d.member_count) / snapshot30d.member_count) * 100
      : null;
    const corporationCountGrowthRate7d = snapshot7d && snapshot7d.corporation_count > 0
      ? ((currentCorpCount - snapshot7d.corporation_count) / snapshot7d.corporation_count) * 100
      : null;
    const corporationCountGrowthRate30d = snapshot30d && snapshot30d.corporation_count > 0
      ? ((currentCorpCount - snapshot30d.corporation_count) / snapshot30d.corporation_count) * 100
      : null;

    return {
      memberCountDelta7d,
      memberCountDelta30d,
      corporationCountDelta7d,
      corporationCountDelta30d,
      memberCountGrowthRate7d,
      memberCountGrowthRate30d,
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

    return snapshots.map(s => ({
      date: s.snapshot_date.toISOString().split('T')[0], // YYYY-MM-DD formatında
      memberCount: s.member_count,
      corporationCount: s.corporation_count,
    }));
  },
};
