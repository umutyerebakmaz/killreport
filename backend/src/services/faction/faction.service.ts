import axios from 'axios';
import { esiRateLimiter } from '../rate-limiter';

export interface ESIFaction {
  faction_id: number;
  name: string;
  description: string;
  corporation_id?: number;
  militia_corporation_id?: number;
  solar_system_id?: number;
  station_count?: number;
  station_system_count?: number;
  size_factor?: number;
  is_unique?: boolean;
}

const ESI_BASE_URL = 'https://esi.evetech.net';

/**
 * Faction service for ESI API interactions.
 *
 * ESI has no /universe/factions/{id}/ endpoint — the list returns all 27
 * objects in full, which is why factions get a queue-less worker rather than
 * the queue/worker fan-out the by-ID domains use.
 */
export class FactionService {
  /**
   * Fetches all factions from ESI (public endpoint)
   * @returns Array of faction objects
   */
  static async getFactions(): Promise<ESIFaction[]> {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get<ESIFaction[]>(
        `${ESI_BASE_URL}/universe/factions`,
      );
      return response.data;
    });
  }
}
