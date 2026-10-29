import { esiClient } from '@services/esi-client';

/**
 * Alliance service for ESI API interactions
 */
export class AllianceService {
  /**
   * Fetches all alliance IDs from ESI
   * @returns Array of alliance IDs
   */
  static async getAllAllianceIds(): Promise<number[]> {
    const response = await esiClient.get<number[]>(`/alliances`);
    return response.data;
  }

  /**
   * Fetches alliance information (public endpoint)
   * @param allianceId - Alliance ID
   * @returns Alliance information
   */
  static async getAllianceInfo(allianceId: number) {
    const response = await esiClient.get<any>(`/alliances/${allianceId}`);
    return response.data;
  }

  /**
   * Fetches corporation IDs that belong to an alliance (public endpoint)
   * @param allianceId - Alliance ID
   * @returns Array of corporation IDs
   */
  static async getAllianceCorporations(allianceId: number): Promise<number[]> {
    const response = await esiClient.get<number[]>(
      `/alliances/${allianceId}/corporations`,
    );
    return response.data;
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
    const response = await esiClient.get<{
      px64x64?: string;
      px128x128?: string;
      px256x256?: string;
    }>(`/alliances/${allianceId}/icons`);
    return response.data;
  }
}
