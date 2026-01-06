import axios from 'axios';
import { esiRateLimiter } from '../rate-limiter';

const ESI_BASE_URL = 'https://esi.evetech.net';

/**
 * Dogma Attribute service for ESI API interactions
 * Handles fetching of dogma attributes that define item characteristics
 */
export class DogmaAttributeService {
  /**
   * Fetches all dogma attribute IDs from ESI
   * @returns Array of dogma attribute IDs
   */
  static async getAllAttributeIds(): Promise<number[]> {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(`${ESI_BASE_URL}/dogma/attributes/`);
      return response.data;
    });
  }

  /**
   * Fetches dogma attribute information (public endpoint)
   * @param attributeId - Dogma attribute ID
   * @returns Dogma attribute information including name, display_name, unit_id, etc.
   */
  static async getAttributeInfo(attributeId: number) {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(
        `${ESI_BASE_URL}/dogma/attributes/${attributeId}/`
      );
      return response.data;
    });
  }

  /**
   * Fetches multiple dogma attribute information in batch
   * @param attributeIds - Array of dogma attribute IDs
   * @returns Array of dogma attribute information objects
   */
  static async getBatchAttributeInfo(attributeIds: number[]) {
    const results = [];

    for (const attributeId of attributeIds) {
      try {
        const info = await this.getAttributeInfo(attributeId);
        results.push(info);
      } catch (error) {
        console.error(`Failed to fetch attribute ${attributeId}:`, error);
      }
    }

    return results;
  }
}
