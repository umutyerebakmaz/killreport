import axios from 'axios';
import { Alliance, MutationResolvers, QueryResolvers } from '../generated-types';
import { publishToQueue } from '../services/rabbitmq';

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
};

export const allianceMutations: MutationResolvers = {
  startAllianceSync: async () => {
    try {
      console.log('Starting alliance sync...');
      const response = await axios.get('https://esi.evetech.net/alliances/');
      const allianceIds: number[] = response.data;

      console.log(`Found ${allianceIds.length} alliances. Publishing to queue...`);

      for (const id of allianceIds) {
        await publishToQueue(String(id));
      }

      console.log('All alliance IDs published to queue.');
      return true;
    } catch (error) {
      console.error('Error starting alliance sync:', error);
      return false;
    }
  },
};
