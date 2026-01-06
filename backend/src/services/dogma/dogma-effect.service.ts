import axios from 'axios';
import { esiRateLimiter } from '../rate-limiter';

const ESI_BASE_URL = 'https://esi.evetech.net/latest';

/**
 * Dogma Effect service for ESI API interactions
 * Handles fetching of dogma effects that define item behaviors and bonuses
 */
export class DogmaEffectService {
  /**
   * Fetches all dogma effect IDs from ESI
   * @returns Array of dogma effect IDs
   */
  static async getAllEffectIds(): Promise<number[]> {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(`${ESI_BASE_URL}/dogma/effects/`);
      return response.data;
    });
  }

  /**
   * Fetches dogma effect information (public endpoint)
   * @param effectId - Dogma effect ID
   * @returns Dogma effect information including name, display_name, modifiers, etc.
   */
  static async getEffectInfo(effectId: number) {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(
        `${ESI_BASE_URL}/dogma/effects/${effectId}/`
      );
      return response.data;
    });
  }

  /**
   * Fetches multiple dogma effect information in batch
   * @param effectIds - Array of dogma effect IDs
   * @returns Array of dogma effect information objects
   */
  static async getBatchEffectInfo(effectIds: number[]) {
    const results = [];

    for (const effectId of effectIds) {
      try {
        const info = await this.getEffectInfo(effectId);
        results.push(info);
      } catch (error) {
        console.error(`Failed to fetch effect ${effectId}:`, error);
      }
    }

    return results;
  }
}
