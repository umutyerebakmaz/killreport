import { esiClient } from '@services/esi-client';

/**
 * Constellation service for ESI API interactions
 */
export class ConstellationService {
  /**
   * Fetches all constellation IDs from ESI
   * @returns Array of constellation IDs
   */
  static async getAllConstellationIds(): Promise<number[]> {
    const response = await esiClient.get<number[]>(`/universe/constellations/`);
    return response.data;
  }

  /**
   * Fetches constellation information (public endpoint)
   * @param constellationId - Constellation ID
   * @returns Constellation information
   */
  static async getConstellationInfo(constellationId: number) {
    const response = await esiClient.get<any>(
      `/universe/constellations/${constellationId}/`,
    );
    return response.data;
  }
}
