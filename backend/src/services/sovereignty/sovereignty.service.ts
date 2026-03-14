import { esiRateLimiter } from '@services/rate-limiter';
import axios from 'axios';

const ESI_BASE_URL = 'https://esi.evetech.net';

interface SovereigntyCampaign {
  attackers_score: number;
  campaign_id: number;
  constellation_id: number;
  defender_id: number;
  defender_score: number;
  event_type: 'tcu_defense' | 'ihub_defense' | 'station_defense' | 'station_freeport';
  participants: Array<{
    alliance_id: number;
    score: number;
  }>;
  solar_system_id: number;
  start_time: string;
  structure_id: number;
}

interface SovereigntyMap {
  alliance_id?: number;
  corporation_id?: number;
  faction_id?: number;
  system_id: number;
}

interface SovereigntyStructure {
  alliance_id: number;
  solar_system_id: number;
  structure_id: number;
  structure_type_id: number;
  vulnerability_occupancy_level?: number;
  vulnerable_end_time?: string;
  vulnerable_start_time?: string;
}

/**
 * Sovereignty service for ESI API interactions
 */
export class SovereigntyService {
  /**
   * Fetches active sovereignty campaigns
   * @returns Array of active sovereignty campaigns
   */
  static async getSovereigntyCampaigns(): Promise<SovereigntyCampaign[]> {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(`${ESI_BASE_URL}/sovereignty/campaigns`);
      return response.data;
    });
  }

  /**
 * Fetches sovereignty map showing which alliances/factions control which systems
 * @returns Array of sovereignty map entries
 */
  static async getSovereigntyMap(): Promise<SovereigntyMap[]> {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(`${ESI_BASE_URL}/sovereignty/map`);
      return response.data;
    });
  }


  /**
   * Fetches all sovereignty structures (TCUs, IHubs, etc.)
       * @returns Array of sovereignty structures
       */
  static async getSovereigntyStructures(): Promise<SovereigntyStructure[]> {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(`${ESI_BASE_URL}/sovereignty/structures`);
      return response.data;
    });
  }
}
