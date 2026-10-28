import { esiClient } from '@services/esi-client';
import { isAxiosError } from 'axios';

export interface EsiKillmail {
  killmail_id: number;
  killmail_hash: string;
}

export interface EsiCorporationHistoryRecord {
  corporation_id: number;
  record_id: number;
  start_date: string;
  // ESI sends this only when the corporation has been closed
  is_deleted?: boolean;
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
    const response = await esiClient.get<any>(`/characters/${characterId}/`);
    return response.data;
  }

  /**
   * Fetches every corporation the character has been a member of (public endpoint)
   * @param characterId - Character ID
   * @returns History records, newest first
   */
  static async getCorporationHistory(
    characterId: number,
  ): Promise<EsiCorporationHistoryRecord[]> {
    const response = await esiClient.get<EsiCorporationHistoryRecord[]>(
      `/characters/${characterId}/corporationhistory/`,
    );
    return response.data;
  }

  /**
   * Fetches character's recent killmails
   * @param characterId - Character ID
   * @param token - Access token (Bearer token)
   * @param maxPages - Maximum pages to fetch (default 50, ESI returns 50 killmails per page)
   * @param stopAtKillmailId - Stop when encountering this killmail ID (for incremental sync)
   * @returns Killmail list (ID and hash)
   */
  static async getCharacterKillmails(
    characterId: number,
    token: string,
    maxPages: number = 50, // Fetch up to 50 pages (2500 killmails max, 50 per page)
    stopAtKillmailId?: number, // For incremental sync - stop when we hit this ID
  ): Promise<EsiKillmail[]> {
    const allKillmails: EsiKillmail[] = [];

    for (let page = 1; page <= maxPages; page++) {
      let killmails: EsiKillmail[] | null;
      try {
        const response = await esiClient.get<EsiKillmail[]>(
          `/characters/${characterId}/killmails/recent/`,
          {
            params: { page },
            headers: { Authorization: `Bearer ${token}` },
            bucketKey: String(characterId),
          },
        );
        killmails = response.data;
      } catch (error) {
        // 404 means no more pages available - this is expected. Anything else,
        // a throttle included, goes to the caller.
        if (isAxiosError(error) && error.response?.status === 404) {
          killmails = null;
        } else {
          console.error(
            `     ❌ error fetching page ${page}:`,
            (error as Error).message,
          );
          throw error;
        }
      }

      // If null returned (404), no more pages
      if (killmails === null) {
        console.log(
          `     ✓ no more pages available (page ${page} returned 404)`,
        );
        break;
      }

      console.log(`     📄 page ${page}: ${killmails.length} killmails`);

      // If no killmails returned, we've reached the end
      if (killmails.length === 0) {
        console.log(`     ✓ reached end of killmails (empty page)`);
        break;
      }

      // Incremental sync optimization: check if we hit the stop point
      if (stopAtKillmailId) {
        const stopIndex = killmails.findIndex(
          (km: EsiKillmail) => km.killmail_id === stopAtKillmailId,
        );

        if (stopIndex !== -1) {
          // Found the stop point - only add killmails before it
          const newKillmails = killmails.slice(0, stopIndex);
          if (newKillmails.length > 0) {
            allKillmails.push(...newKillmails);
          }
          console.log(
            `     ✅ incremental sync: found last synced killmail (ID: ${stopAtKillmailId})`,
          );
          console.log(
            `     ⏭️  stopping at page ${page} - fetched ${newKillmails.length} new killmails from this page`,
          );
          console.log(`     📊 total new killmails: ${allKillmails.length}`);
          break;
        }
      }

      allKillmails.push(...killmails);

      // ESI returns exactly 50 killmails per page when there are more pages available
      // If less than 50 returned, this is the last page
      if (killmails.length < 50) {
        console.log(
          `     ✓ last page detected (${killmails.length} < 50 killmails)`,
        );
        break;
      }

      console.log(`     ➡️  continuing to page ${page + 1}...`);
    }

    console.log(`     ✅ total: ${allKillmails.length} killmails from ESI`);
    return allKillmails;
  }
}
