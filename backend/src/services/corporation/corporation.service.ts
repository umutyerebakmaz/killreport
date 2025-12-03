import axios from 'axios';
import { esiRateLimiter } from '../rate-limiter';

const ESI_BASE_URL = 'https://esi.evetech.net';

export interface EsiKillmail {
  killmail_id: number;
  killmail_hash: string;
}

/**
 * Corporation service for ESI API interactions
 */
export class CorporationService {
  /**
   * Fetches corporation information (public endpoint)
   * @param corporationId - Corporation ID
   * @returns Corporation information
   */
  static async getCorporationInfo(corporationId: number) {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(
        `${ESI_BASE_URL}/corporations/${corporationId}/`
      );
      return response.data;
    });
  }

  /**
   * Fetches corporation killmails (requires authorization)
   * Scope: esi-killmails.read_corporation_killmails.v1
   * @param corporationId - Corporation ID
   * @param token - Access token
   * @returns Killmail list
   */
  static async getCorporationKillmails(
    corporationId: number,
    token: string
  ): Promise<EsiKillmail[]> {
    const url = `${ESI_BASE_URL}/corporations/${corporationId}/killmails/recent/`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Failed to fetch corporation killmails: ${response.status} - ${error}`
      );
    }

    return response.json();
  }
}
