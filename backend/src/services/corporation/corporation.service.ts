import { esiClient } from '@services/esi-client';
import { isAxiosError } from 'axios';
import logger from '../logger';

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
    const response = await esiClient.get<any>(
      `/corporations/${corporationId}/`,
    );
    return response.data;
  }

  /**
   * Fetches corporation killmails (requires authorization)
   * Scope: esi-killmails.read_corporation_killmails.v1
   * @param corporationId - Corporation ID
   * @param token - Access token
   * @param characterId - The character the token belongs to; keys the limiter's
   *   per-character killmails/recent bucket
   * @param maxPages - Maximum pages to fetch (default 50, ESI returns 50 killmails per page)
   * @param stopAtKillmailId - Stop when encountering this killmail ID (for incremental sync)
   * @returns Killmail list (ID and hash)
   */
  static async getCorporationKillmails(
    corporationId: number,
    token: string,
    characterId: number,
    maxPages: number = 50,
    stopAtKillmailId?: number,
  ): Promise<EsiKillmail[]> {
    const allKillmails: EsiKillmail[] = [];

    for (let page = 1; page <= maxPages; page++) {
      let killmails: EsiKillmail[] | null;
      try {
        const response = await esiClient.get<EsiKillmail[]>(
          `/corporations/${corporationId}/killmails/recent/`,
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
          logger.error(
            `     ❌ error fetching page ${page}:`,
            (error as Error).message,
          );
          throw error;
        }
      }

      // If null returned (404), no more pages
      if (killmails === null) {
        logger.info(
          `     ✓ no more pages available (page ${page} returned 404)`,
        );
        break;
      }

      logger.info(`     📄 page ${page}: ${killmails.length} killmails`);

      // If no killmails returned, we've reached the end
      if (killmails.length === 0) {
        logger.info(`     ✓ reached end of killmails (empty page)`);
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
          logger.info(
            `     ✅ incremental sync: found last synced killmail (ID: ${stopAtKillmailId})`,
          );
          logger.info(
            `     ⏭️  stopping at page ${page} - fetched ${newKillmails.length} new killmails from this page`,
          );
          logger.info(`     📊 total new killmails: ${allKillmails.length}`);
          break;
        }
      }

      allKillmails.push(...killmails);

      // ESI returns exactly 50 killmails per page when there are more pages available
      // If less than 50 returned, this is the last page
      if (killmails.length < 50) {
        logger.info(
          `     ✓ last page detected (${killmails.length} < 50 killmails)`,
        );
        break;
      }

      logger.info(`     ➡️  continuing to page ${page + 1}...`);
    }

    logger.info(`     ✅ total: ${allKillmails.length} killmails from ESI`);
    return allKillmails;
  }
}
