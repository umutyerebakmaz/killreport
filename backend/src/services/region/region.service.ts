import axios from 'axios';
import { esiRateLimiter } from '../rate-limiter';

const ESI_BASE_URL = 'https://esi.evetech.net';

/**
 * Region service for ESI API interactions
 */
export class RegionService {
  /**
   * Fetches all region IDs from ESI
   * @returns Array of region IDs
   */
  static async getAllRegionIds(): Promise<number[]> {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(`${ESI_BASE_URL}/universe/regions/`);
      return response.data;
    });
  }

  /**
   * Fetches region information (public endpoint)
   * @param regionId - Region ID
   * @returns Region information
   */
  static async getRegionInfo(regionId: number) {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(
        `${ESI_BASE_URL}/universe/regions/${regionId}/`
      );
      return response.data;
    });
  }
}
