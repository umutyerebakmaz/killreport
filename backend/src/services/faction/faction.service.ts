import { esiClient } from '@services/esi-client';

export interface ESIFaction {
  faction_id: number;
  name: string;
  description: string;
  corporation_id?: number;
  militia_corporation_id?: number;
  solar_system_id?: number;
  station_count?: number;
  station_system_count?: number;
  size_factor?: number;
  is_unique?: boolean;
}

/**
 * Faction service for ESI API interactions.
 *
 * ESI has no /universe/factions/{id}/ endpoint — the list returns all 27
 * objects in full, which is why factions get a queue-less worker rather than
 * the queue/worker fan-out the by-ID domains use.
 */
export class FactionService {
  /**
   * Fetches all factions from ESI (public endpoint)
   * @returns Array of faction objects
   */
  static async getFactions(): Promise<ESIFaction[]> {
    const response = await esiClient.get<ESIFaction[]>(`/universe/factions`);
    return response.data;
  }
}
