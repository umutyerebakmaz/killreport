import axios from 'axios';
import { esiRateLimiter } from '../rate-limiter';

const ESI_BASE_URL = 'https://esi.evetech.net';

export interface EsiKillmail {
  killmail_id: number;
  killmail_hash: string;
}

/**
 * Character service for ESI API interactions
 */
export class CharacterService {
  /**
   * Fetches character information (public endpoint)
   * @param characterId - Character ID
   * @returns Character information
   */
  static async getCharacterInfo(characterId: number) {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get(
        `${ESI_BASE_URL}/characters/${characterId}/`
      );
      return response.data;
    });
  }

  /**
   * Fetches character's recent killmails
   * @param characterId - Character ID
   * @param token - Access token (Bearer token)
   * @returns Killmail list (ID and hash)
   */
  static async getCharacterKillmails(
    characterId: number,
    token: string,
    maxPages: number = 100 // Fetch up to 100 pages (2500 killmails max, 25 per page)
  ): Promise<EsiKillmail[]> {
    const allKillmails: EsiKillmail[] = [];

    for (let page = 1; page <= maxPages; page++) {
      const url = `${ESI_BASE_URL}/characters/${characterId}/killmails/recent/?page=${page}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // 404 means no more pages available - this is expected
        if (response.status === 404) {
          console.log(`     ✓ No more pages available (404)`);
          break;
        }

        // Other errors should be thrown
        const error = await response.text();
        throw new Error(
          `Failed to fetch character killmails: ${response.status} - ${error}`
        );
      }

      const killmails: EsiKillmail[] = await response.json();

      console.log(`     📄 Page ${page}: ${killmails.length} killmails`);

      // If no killmails returned, we've reached the end
      if (killmails.length === 0) {
        console.log(`     ✓ Reached end of killmails (empty page)`);
        break;
      }

      allKillmails.push(...killmails);

      // If less than 25 returned, this is the last page
      if (killmails.length < 25) {
        console.log(`     ✓ Last page (${killmails.length} < 25)`);
        break;
      }

      // Small delay to respect ESI rate limits (150 requests/second limit)
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`     ✅ Total: ${allKillmails.length} killmails from ESI`);
    return allKillmails;
  }
}
