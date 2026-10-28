import { esiClient } from '@services/esi-client';

/**
 * Region service for ESI API interactions
 */
export class RegionService {
  /**
   * Fetches all region IDs from ESI
   * @returns Array of region IDs
   */
  static async getAllRegionIds(): Promise<number[]> {
    const response = await esiClient.get<number[]>(`/universe/regions/`);
    return response.data;
  }

  /**
   * Fetches region information (public endpoint)
   * @param regionId - Region ID
   * @returns Region information
   */
  static async getRegionInfo(regionId: number) {
    const response = await esiClient.get<any>(`/universe/regions/${regionId}/`);
    return response.data;
  }
}
