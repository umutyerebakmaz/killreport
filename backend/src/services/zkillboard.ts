/**
 * zKillboard API Service
 * Full killmail history from zKillboard.com
 */


const ZKILL_BASE_URL = 'https://zkillboard.com/api';

export interface ZKillPackage {
    killmail_id: number;
    zkb: {
        locationID: number;
        hash: string;
        fittedValue: number;
        droppedValue: number;
        destroyedValue: number;
        totalValue: number;
        points: number;
        npc: boolean;
        solo: boolean;
        awox: boolean;
    };
}

/**
 * Fetch killmails for a character from zKillboard
 * This gets ALL historical killmails, not just recent ones
 *
 * @param characterId - Character ID
 * @param options - Pagination options
 * @returns Array of killmail packages
 */
export async function getCharacterKillmailsFromZKill(
    characterId: number,
    options: {
        page?: number;
        limit?: number;
        maxPages?: number;
        characterName?: string;
    } = {}
): Promise<ZKillPackage[]> {
    const { page = 1, limit = 200, maxPages = 50, characterName } = options;
    const allKillmails: ZKillPackage[] = [];

    const prefix = characterName ? `[${characterName}]` : '';
    console.log(`  🔍 ${prefix} Fetching from zKillboard (max ${maxPages} pages, ${limit} per page)...`);

    for (let currentPage = page; currentPage <= maxPages; currentPage++) {
        const url = `${ZKILL_BASE_URL}/characterID/${characterId}/page/${currentPage}/`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Killreport App - Contact: your@email.com',
                    'Accept-Encoding': 'gzip',
                },
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`     ✓ ${prefix} No more pages available`);
                    break;
                }
                throw new Error(`zKillboard API error: ${response.status}`);
            }

            let killmails: ZKillPackage[];
            try {
                killmails = await response.json();
            } catch (jsonError) {
                console.log(`     ⚠️  ${prefix} Failed to parse JSON on page ${currentPage}, stopping`);
                break;
            }

            // Validate killmails is an array
            if (!Array.isArray(killmails)) {
                console.log(`     ⚠️  ${prefix} Invalid response format on page ${currentPage}, stopping`);
                break;
            }

            console.log(`     📄 ${prefix} Page ${currentPage}: ${killmails.length} killmails`);

            if (killmails.length === 0) {
                console.log(`     ✓ ${prefix} Reached end (empty page)`);
                break;
            }

            allKillmails.push(...killmails);

            // zKillboard rate limit: 1 request per second
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Stop if we got less than expected (last page)
            if (killmails.length < limit) {
                console.log(`     ✓ ${prefix} Last page (${killmails.length} < ${limit})`);
                break;
            }
        } catch (error) {
            console.error(`     ❌ ${prefix} Error fetching page ${currentPage}:`, error);
            break;
        }
    }

    console.log(`     ✅ ${prefix} Total: ${allKillmails.length} killmails from zKillboard`);
    return allKillmails;
}

/**
 * Fetch corporation killmails from zKillboard
 */
export async function getCorporationKillmailsFromZKill(
    corporationId: number,
    options: {
        page?: number;
        limit?: number;
        maxPages?: number;
    } = {}
): Promise<ZKillPackage[]> {
    const { page = 1, limit = 200, maxPages = 50 } = options;
    const allKillmails: ZKillPackage[] = [];

    for (let currentPage = page; currentPage <= maxPages; currentPage++) {
        const url = `${ZKILL_BASE_URL}/corporationID/${corporationId}/page/${currentPage}/`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Killreport App',
                    'Accept-Encoding': 'gzip',
                },
            });

            if (!response.ok) {
                if (response.status === 404) break;
                throw new Error(`zKillboard API error: ${response.status}`);
            }

            const killmails: ZKillPackage[] = await response.json();

            if (killmails.length === 0) break;

            allKillmails.push(...killmails);

            await new Promise(resolve => setTimeout(resolve, 1000));

            if (killmails.length < limit) break;
        } catch (error) {
            console.error(`Error fetching corp page ${currentPage}:`, error);
            break;
        }
    }

    return allKillmails;
}

/**
 * Fetch alliance killmails from zKillboard
 */
export async function getAllianceKillmailsFromZKill(
    allianceId: number,
    options: {
        page?: number;
        limit?: number;
        maxPages?: number;
    } = {}
): Promise<ZKillPackage[]> {
    const { page = 1, limit = 200, maxPages = 50 } = options;
    const allKillmails: ZKillPackage[] = [];

    for (let currentPage = page; currentPage <= maxPages; currentPage++) {
        const url = `${ZKILL_BASE_URL}/allianceID/${allianceId}/page/${currentPage}/`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Killreport App',
                    'Accept-Encoding': 'gzip',
                },
            });

            if (!response.ok) {
                if (response.status === 404) break;
                throw new Error(`zKillboard API error: ${response.status}`);
            }

            const killmails: ZKillPackage[] = await response.json();

            if (killmails.length === 0) break;

            allKillmails.push(...killmails);

            await new Promise(resolve => setTimeout(resolve, 1000));

            if (killmails.length < limit) break;
        } catch (error) {
            console.error(`Error fetching alliance page ${currentPage}:`, error);
            break;
        }
    }

    return allKillmails;
}
