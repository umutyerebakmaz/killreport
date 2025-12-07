import axios from 'axios';
import { esiRateLimiter } from '../rate-limiter';

const ESI_BASE_URL = 'https://esi.evetech.net';

/**
 * Constellation service for ESI API interactions
 */
export class ConstellationService {
  /**
   * Fetches all constellation IDs from ESI
   * @returns Array of constellation IDs
   */
  static async getAllConstellationIds(): Promise<number[]> {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(`${ESI_BASE_URL}/universe/constellations/`);
      return response.data;
    });
  }

  /**
   * Fetches constellation information (public endpoint)
   * @param constellationId - Constellation ID
   * @returns Constellation information
   */
  static async getConstellationInfo(constellationId: number) {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(
        `${ESI_BASE_URL}/universe/constellations/${constellationId}/`
      );
      return response.data;
    });
  }
}
