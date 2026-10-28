import { esiClient } from '@services/esi-client';
import { EsiThrottledError } from '@services/rate-limiter';

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
    const response = await esiClient.get<number[]>(`/dogma/attributes/`);
    return response.data;
  }

  /**
   * Fetches dogma attribute information (public endpoint)
   * @param attributeId - Dogma attribute ID
   * @returns Dogma attribute information including name, display_name, unit_id, etc.
   */
  static async getAttributeInfo(attributeId: number) {
    const response = await esiClient.get<any>(
      `/dogma/attributes/${attributeId}/`,
    );
    return response.data;
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
        if (error instanceof EsiThrottledError) throw error;
        console.error(`failed to fetch attribute ${attributeId}:`, error);
      }
    }

    return results;
  }
}
