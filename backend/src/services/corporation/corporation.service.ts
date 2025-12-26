import axios from 'axios';
import logger from '../logger';
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
     * @param maxPages - Maximum pages to fetch (default 50, ESI returns 50 killmails per page)
     * @param stopAtKillmailId - Stop when encountering this killmail ID (for incremental sync)
     * @returns Killmail list (ID and hash)
     */
    static async getCorporationKillmails(
        corporationId: number,
        token: string,
        maxPages: number = 50,
        stopAtKillmailId?: number
    ): Promise<EsiKillmail[]> {
        const allKillmails: EsiKillmail[] = [];

        for (let page = 1; page <= maxPages; page++) {
            try {
                const killmails = await esiRateLimiter.execute(async () => {
                    const url = `${ESI_BASE_URL}/corporations/${corporationId}/killmails/recent/?page=${page}`;

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

                        // 403 means user doesn't have permission
                        if (response.status === 403) {
                            throw new Error(
                                'Forbidden: User does not have permission to read corporation killmails. ' +
                                'Required role: Director or CEO with esi-killmails.read_corporation_killmails.v1 scope'
                            );
                        }

                        // Other errors should be thrown
                        const error = await response.text();
                        throw new Error(
                            `Failed to fetch corporation killmails: ${response.status} - ${error}`
                        );
                    }

                    return response.json();
                });

                // If null returned (404), no more pages
                if (killmails === null) {
                    logger.info(`     ✓ No more pages available (page ${page} returned 404)`);
                    break;
                }

                logger.debug(`     📄 Page ${page}: ${killmails.length} killmails`);

                // If no killmails returned, we've reached the end
                if (killmails.length === 0) {
                    logger.info(`     ✓ Reached end of killmails (empty page)`);
                    break;
                }

                // Incremental sync optimization: check if we hit the stop point
                if (stopAtKillmailId) {
                    const stopIndex = killmails.findIndex((km: EsiKillmail) => km.killmail_id === stopAtKillmailId);

                    if (stopIndex !== -1) {
                        // Found the stop point - only add killmails before it
                        const newKillmails = killmails.slice(0, stopIndex);
                        if (newKillmails.length > 0) {
                            allKillmails.push(...newKillmails);
                        }
                        logger.info(`     ✅ Incremental sync: Found last synced killmail (ID: ${stopAtKillmailId})`);
                        logger.info(`     ⏭️  Stopping at page ${page} - fetched ${newKillmails.length} new killmails from this page`);
                        logger.info(`     📊 Total new killmails: ${allKillmails.length}`);
                        break;
                    }
                }

                allKillmails.push(...killmails);

                // ESI returns exactly 50 killmails per page when there are more pages available
                // If less than 50 returned, this is the last page
                if (killmails.length < 50) {
                    logger.info(`     ✓ Last page detected (${killmails.length} < 50 killmails)`);
                    break;
                }

                logger.debug(`     ➡️  Continuing to page ${page + 1}...`);

                // Add extra delay between pages to prevent rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error: any) {
                logger.error(`     ❌ Error fetching page ${page}:`, error.message);

                // If rate limited, wait and retry once
                if (error.message.includes('420') || error.message.includes('429') || error.message.includes('Rate limit')) {
                    logger.warn(`     ⏳ Rate limited, waiting 5 seconds before retry...`);
                    await new Promise(resolve => setTimeout(resolve, 5000));

                    // Retry the same page
                    try {
                        const retryKillmails = await esiRateLimiter.execute(async () => {
                            const url = `${ESI_BASE_URL}/corporations/${corporationId}/killmails/recent/?page=${page}`;
                            const response = await fetch(url, {
                                headers: { Authorization: `Bearer ${token}` },
                            });
                            if (!response.ok) {
                                if (response.status === 404) return null;
                                const error = await response.text();
                                throw new Error(`Failed to fetch corporation killmails: ${response.status} - ${error}`);
                            }
                            return response.json();
                        });

                        if (retryKillmails) {
                            logger.info(`     ✅ Retry successful: ${retryKillmails.length} killmails`);
                            allKillmails.push(...retryKillmails);
                            if (retryKillmails.length < 50) break;
                        } else {
                            break;
                        }
                    } catch (retryError: any) {
                        logger.error(`     ❌ Retry failed:`, retryError.message);
                        throw error; // Throw original error
                    }
                } else {
                    throw error;
                }
            }
        }

        logger.info(`     ✅ Total: ${allKillmails.length} killmails from ESI`);
        return allKillmails;
    }
}
