import axios from 'axios';
import { esiRateLimiter } from '../rate-limiter';

const ESI_BASE_URL = 'https://esi.evetech.net';

/**
 * SolarSystem service for ESI API interactions
 */
export class SolarSystemService {
  /**
   * Fetches all solar system IDs from ESI
   * @returns Array of solar system IDs
   */
  static async getAllSystemIds(): Promise<number[]> {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(`${ESI_BASE_URL}/universe/systems/`);
      return response.data;
    });
  }

  /**
   * Fetches solar system information (public endpoint)
   * @param systemId - Solar system ID
   * @returns Solar system information
   */
  static async getSystemInfo(systemId: number) {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(
        `${ESI_BASE_URL}/universe/systems/${systemId}/`
      );
      return response.data;
    });
  }

  /**
   * Get the number of ship, pod and NPC kills per solar system within the last hour
   *
   * ESI Route: GET /universe/system_kills/
   *
   * @description
   * Fetches kill statistics for all solar systems from ESI. Returns the number of kills
   * within the last hour for each system with activity.
   *
   * Important Notes:
   * - Only systems with kills are included in the response
   * - Wormhole space (J-space) systems are excluded
   * - Data is cached for 1 hour on ESI side
   *
   * @returns {Promise<Array>} Array of system kill statistics
   * @returns {number} return[].system_id - Solar system ID
   * @returns {number} return[].npc_kills - Number of NPC ships killed
   * @returns {number} return[].pod_kills - Number of pods killed
   * @returns {number} return[].ship_kills - Number of player ships killed
   *
   * @example
   * const kills = await SolarSystemService.getSystemKills();
   * // Returns: [
   * //   { system_id: 30000142, npc_kills: 158, pod_kills: 3, ship_kills: 12 },
   * //   { system_id: 30002187, npc_kills: 245, pod_kills: 1, ship_kills: 5 },
   * //   ...
   * // ]
   *
   * @see https://developers.eveonline.com/api-explorer#/operations/GetUniverseSystemKills
   */
  static async getSystemKills() {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(
        `${ESI_BASE_URL}/universe/system_kills`,
        {
          headers: {
            'X-Compatibility-Date': '2025-12-16',
            'Accept-Language': 'en',
            'X-Tenant': 'tranquility',
          },
        }
      );
      return response.data;
    });
  }

}
