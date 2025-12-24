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

                // Add extra delay between pages to prevent rate limiting
                // ESI allows 150 req/sec but we play it safe with multiple workers
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error: any) {
                console.error(`     ❌ Error fetching page ${page}:`, error.message);

                // If rate limited, wait and retry once
                if (error.message.includes('420') || error.message.includes('Rate limit')) {
                    console.log(`     ⏳ Rate limited, waiting 2 seconds before retry...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Retry the same page
                    try {
                        const retryKillmails = await esiRateLimiter.execute(async () => {
                            const url = `${ESI_BASE_URL}/characters/${characterId}/killmails/recent/?page=${page}`;
                            const response = await fetch(url, {
                                headers: { Authorization: `Bearer ${token}` },
                            });
                            if (!response.ok) {
                                if (response.status === 404) return null;
                                const error = await response.text();
                                throw new Error(`Failed to fetch character killmails: ${response.status} - ${error}`);
                            }
                            return response.json();
                        });

                        if (retryKillmails) {
                            console.log(`     ✅ Retry successful: ${retryKillmails.length} killmails`);
                            allKillmails.push(...retryKillmails);
                            if (retryKillmails.length < 50) break;
                        } else {
                            break;
                        }
                    } catch (retryError: any) {
                        console.error(`     ❌ Retry failed:`, retryError.message);
                        throw error; // Throw original error
                    }
                } else {
                    throw error;
                }
            }
        }

        console.log(`     ✅ Total: ${allKillmails.length} killmails from ESI`);
        return allKillmails;
    }
}
