import axios from 'axios';
import { esiRateLimiter } from '../rate-limiter';

const ESI_BASE_URL = 'https://esi.evetech.net';

/**
 * SolarSystem service for ESI API interactions
 */
export class SolarSystemService {
  /**
   * Fetches all solar system IDs from ESI
   * @returns Array of solar system IDs
   */
  static async getAllSystemIds(): Promise<number[]> {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(`${ESI_BASE_URL}/universe/systems/`);
      return response.data;
    });
  }

  /**
   * Fetches solar system information (public endpoint)
   * @param systemId - Solar system ID
   * @returns Solar system information
   */
  static async getSystemInfo(systemId: number) {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(
        `${ESI_BASE_URL}/universe/systems/${systemId}/`
      );
      return response.data;
    });
  }
}
