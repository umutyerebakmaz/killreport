import axios from 'axios';
import { QueryResolvers, Alliance } from '../generated-types';

export const allianceQueries: QueryResolvers = {
  alliance: async (_, { id }): Promise<Alliance | null> => {
    try {
      const response = await axios.get(`https://esi.evetech.net/latest/alliances/${id}/`);
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
      // In a real app, you might want to handle different error types
      // (e.g., 404 Not Found vs. other ESI errors)
      return null;
    }
  },
};
