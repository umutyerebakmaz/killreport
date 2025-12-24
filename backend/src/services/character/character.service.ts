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
     * @param maxPages - Maximum pages to fetch (default 50, ESI returns 50 killmails per page)
     * @returns Killmail list (ID and hash)
     */
    static async getCharacterKillmails(
        characterId: number,
        token: string,
        maxPages: number = 50 // Fetch up to 50 pages (2500 killmails max, 50 per page)
    ): Promise<EsiKillmail[]> {
        const allKillmails: EsiKillmail[] = [];

        for (let page = 1; page <= maxPages; page++) {
            try {
                const killmails = await esiRateLimiter.execute(async () => {
                    const url = `${ESI_BASE_URL}/characters/${characterId}/killmails/recent/?page=${page}`;

                    const response = await fetch(url, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    });

                    if (!response.ok) {
                        // 404 means no more pages available - this is expected
                        if (response.status === 404) {
                            return null; // Signal end of pages
                        }

                        // Other errors should be thrown
                        const error = await response.text();
                        throw new Error(
                            `Failed to fetch character killmails: ${response.status} - ${error}`
                        );
                    }

                    return response.json();
                });

                // If null returned (404), no more pages
                if (killmails === null) {
                    console.log(`     ✓ No more pages available (page ${page} returned 404)`);
                    break;
                }

                console.log(`     📄 Page ${page}: ${killmails.length} killmails`);

                // If no killmails returned, we've reached the end
                if (killmails.length === 0) {
                    console.log(`     ✓ Reached end of killmails (empty page)`);
                    break;
                }

                allKillmails.push(...killmails);

                // If less than 50 returned, this is the last page (ESI returns 50 per page)
                if (killmails.length < 50) {
                    console.log(`     ✓ Last page (${killmails.length} < 50)`);
                    break;
                }
            } catch (error: any) {
                console.error(`     ❌ Error fetching page ${page}:`, error.message);
                throw error;
            }
        }

        console.log(`     ✅ Total: ${allKillmails.length} killmails from ESI`);
        return allKillmails;
    }
}
