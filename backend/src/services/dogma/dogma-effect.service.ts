import { esiClient } from '@services/esi-client';
import { EsiThrottledError } from '@services/rate-limiter';

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
    const response = await esiClient.get<number[]>(`/latest/dogma/effects/`);
    return response.data;
  }

  /**
   * Fetches dogma effect information (public endpoint)
   * @param effectId - Dogma effect ID
   * @returns Dogma effect information including name, display_name, modifiers, etc.
   */
  static async getEffectInfo(effectId: number) {
    const response = await esiClient.get<any>(
      `/latest/dogma/effects/${effectId}/`,
    );
    return response.data;
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
        if (error instanceof EsiThrottledError) throw error;
        console.error(`failed to fetch effect ${effectId}:`, error);
      }
    }

    return results;
  }
}
