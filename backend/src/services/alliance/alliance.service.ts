import axios from 'axios';
import { esiRateLimiter } from '../rate-limiter';

const ESI_BASE_URL = 'https://esi.evetech.net';

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
      const response = await axios.get(`${ESI_BASE_URL}/alliances`);
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
        `${ESI_BASE_URL}/alliances/${allianceId}`
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
        `${ESI_BASE_URL}/alliances/${allianceId}/corporations`
      );
      return response.data;
    });
  }

  /**
   * Fetches alliance icon URLs (public endpoint)
   * @param allianceId - Alliance ID
   * @returns Alliance icon URLs (px64x64, px128x128, px256x256)
   */
  static async getAllianceIcon(allianceId: number): Promise<{
    px64x64?: string;
    px128x128?: string;
    px256x256?: string;
  }> {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(
        `${ESI_BASE_URL}/alliances/${allianceId}/icons`
      );
      return response.data;
    });
  }
}
