/**
 * Killmail service for ESI API interactions
 */

const ESI_BASE_URL = 'https://esi.evetech.net';

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
    killmailHash: string
  ): Promise<KillmailDetail> {
    const url = `${ESI_BASE_URL}/killmails/${killmailId}/${killmailHash}/`;

    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Failed to fetch killmail detail: ${response.status} - ${error}`
      );
    }

    return response.json();
  }
}
