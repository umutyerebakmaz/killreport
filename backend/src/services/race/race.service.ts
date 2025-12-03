import axios from 'axios';
import { esiRateLimiter } from '../rate-limiter';

export interface ESIRace {
  race_id: number;
  name: string;
  description: string;
}

const ESI_BASE_URL = 'https://esi.evetech.net';
/**
 * Race service for ESI API interactions
 */
export class RaceService {
  /**
   * Fetches all races from ESI (public endpoint)
   * @returns Array of race objects
   */
  static async getRaces(): Promise<ESIRace[]> {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get<ESIRace[]>(
        `${ESI_BASE_URL}/universe/races`
      );
      return response.data;
    });
  }
}
