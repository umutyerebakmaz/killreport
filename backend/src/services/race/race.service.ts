import { esiClient } from '@services/esi-client';

export interface ESIRace {
  race_id: number;
  name: string;
  description: string;
}

/**
 * Race service for ESI API interactions
 */
export class RaceService {
  /**
   * Fetches all races from ESI (public endpoint)
   * @returns Array of race objects
   */
  static async getRaces(): Promise<ESIRace[]> {
    const response = await esiClient.get<ESIRace[]>(`/universe/races`);
    return response.data;
  }
}
