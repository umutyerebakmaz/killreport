import axios from 'axios';
import { Alliance, AlliancesResponse, MutationResolvers, PageInfo, QueryResolvers } from '../generated-types';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

export const allianceQueries: QueryResolvers = {
  alliance: async (_, { id }): Promise<Alliance | null> => {
    const alliance = await prisma.alliance.findUnique({
      where: { id: Number(id) },
    });
    if (!alliance) return null;
    return {
      ...alliance,
      date_founded: alliance.date_founded.toISOString(),
    };
  },

  alliances: async (_, { filter }): Promise<AlliancesResponse> => {
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

    // Toplam kayıt sayısı (filtrelenmiş)
    const totalCount = await prisma.alliance.count({ where });
    const totalPages = Math.ceil(totalCount / take);

    // Verileri çek
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
      data: alliances.map(a => ({
        ...a,
        date_founded: a.date_founded.toISOString(),
      })),
      pageInfo,
    };
  },
};

export const allianceMutations: MutationResolvers = {
  startAllianceSync: async () => {
    try {
      console.log('🚀 Starting alliance sync via GraphQL...');

      // ESI'den tüm alliance ID'lerini al
      const response = await axios.get('https://esi.evetech.net/latest/alliances/');
      const allianceIds: number[] = response.data;

      console.log(`✓ Found ${allianceIds.length} alliances`);
      console.log(`📤 Publishing to queue...`);

      // RabbitMQ'ya ekle
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
      return true;
    } catch (error) {
      console.error('❌ Error starting alliance sync:', error);
      return false;
    }
  },
};
