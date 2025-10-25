import axios from 'axios';
import { Alliance, MutationResolvers, QueryResolvers } from '../generated-types';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

export const allianceQueries: QueryResolvers = {
  alliance: async (_, { id }): Promise<Alliance | null> => {
    try {
      const response = await axios.get(`https://esi.evetech.net/alliances/${id}/`);
      const allianceData = response.data;

      return {
        id,
        name: allianceData.name,
        ticker: allianceData.ticker,
        date_founded: allianceData.date_founded,
        creator_corporation_id: allianceData.creator_corporation_id,
        creator_id: allianceData.creator_id,
        executor_corporation_id: allianceData.executor_corporation_id,
        faction_id: allianceData.faction_id || null,
      };
    } catch (error) {
      console.error(`Error fetching alliance with id ${id}:`, error);
      return null;
    }
  },

  alliances: async (_, { after, limit }): Promise<Alliance[]> => {
    // after: cursor (alliance id), limit: kaç veri döneceği
    const take = limit ?? 20;
    const cursorId = after ? Number(after) : undefined;

    const alliances = await prisma.alliance.findMany({
      take,
      ...(cursorId && { skip: 1, cursor: { id: cursorId } }),
      orderBy: { id: 'asc' },
    });

    // Prisma'dan gelen date_founded Date objesini string'e çevir
    return alliances.map(a => ({
      ...a,
      date_founded: a.date_founded.toISOString(),
    }));
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
