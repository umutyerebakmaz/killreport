import axios from 'axios';
import { esiRateLimiter } from '../rate-limiter';

const ESI_BASE_URL = 'https://esi.evetech.net/latest';

/**
 * Alliance service for ESI API interactions
 */
export class AllianceService {
  /**
   * Fetches all alliance IDs from ESI
   * @returns Array of alliance IDs
   */
  static async getAllAllianceIds(): Promise<number[]> {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(`${ESI_BASE_URL}/alliances/`);
      return response.data;
    });
  }

  /**
   * Fetches alliance information (public endpoint)
   * @param allianceId - Alliance ID
   * @returns Alliance information
   */
  static async getAllianceInfo(allianceId: number) {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(
        `${ESI_BASE_URL}/alliances/${allianceId}/?datasource=tranquility`
      );
      return response.data;
    });
  }

  /**
   * Fetches corporation IDs that belong to an alliance (public endpoint)
   * @param allianceId - Alliance ID
   * @returns Array of corporation IDs
   */
  static async getAllianceCorporations(allianceId: number): Promise<number[]> {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(
        `${ESI_BASE_URL}/alliances/${allianceId}/corporations/?datasource=tranquility`
      );
      return response.data;
    });
  }
}
