/**
 * Killmail service for ESI API interactions
 */

import { esiClient } from '@services/esi-client';

export interface EsiKillmail {
  killmail_id: number;
  killmail_hash: string;
}

export interface KillmailDetail {
  killmail_id: number;
  killmail_time: string;
  solar_system_id: number;
  victim: {
    character_id?: number;
    corporation_id: number;
    alliance_id?: number;
    faction_id?: number;
    ship_type_id: number;
    damage_taken: number;
    position?: {
      x: number;
      y: number;
      z: number;
    };
    items?: Array<{
      item_type_id: number;
      flag: number;
      quantity_dropped?: number;
      quantity_destroyed?: number;
      singleton: number;
      items?: Array<{
        item_type_id: number;
        flag: number;
        quantity_dropped?: number;
        quantity_destroyed?: number;
        singleton: number;
      }>;
    }>;
  };
  attackers: Array<{
    character_id?: number;
    corporation_id?: number;
    alliance_id?: number;
    faction_id?: number;
    ship_type_id?: number;
    weapon_type_id?: number;
    damage_done: number;
    final_blow: boolean;
    security_status: number;
  }>;
}

/**
 * Killmail service for ESI API interactions
 */
export class KillmailService {
  /**
   * Fetches killmail details (public endpoint, no token required)
   * @param killmailId - Killmail ID
   * @param killmailHash - Killmail hash
   * @returns Killmail details
   */
  static async getKillmailDetail(
    killmailId: number,
    killmailHash: string,
  ): Promise<KillmailDetail> {
    const response = await esiClient.get<KillmailDetail>(
      `/killmails/${killmailId}/${killmailHash}/`,
    );
    return response.data;
  }
}
