/**
 * Cache Configuration Constants
 */

/**
 * Cache TTL values in milliseconds
 */
export const CACHE_TTL = {
    /** Killmail details never change */
    KILLMAIL_DETAIL: 7776000_000, // 90 days

    /** Static game data (types, categories, groups, dogma attributes) - never changes */
    STATIC_GAME_DATA: 31536000_000, // 365 days (1 year)

    /** Character/Corporation/Alliance info (rarely changes) */
    ENTITY_INFO: 31536000_000, // 365 days (1 year)

    /** Killmails list - first pages (new killmails arrive frequently) */
    KILLMAIL_LIST_FIRST_PAGES: 60_000, // 1 minute

    /** Killmails list - later pages (less frequently accessed) */
    KILLMAIL_LIST: 300_000, // 5 minutes

    /** Default for other public queries */
    DEFAULT_PUBLIC: 120_000, // 2 minutes

    /** Redis default when no specific TTL */
    REDIS_DEFAULT: 60_000, // 1 minute
} as const;

/**
 * Public queries that can be cached for all users
 * Private queries (user-specific) will use per-user cache
 */
export const PUBLIC_CACHE_QUERIES = [
    // List queries
    'Alliances',
    'Corporations',
    'Characters',
    'Killmails',
    'KillmailsDateCounts',
    'Types',
    'Categories',
    'ItemGroups',
    'Regions',
    'Constellations',
    'SolarSystems',

    // Detail page queries (single entity)
    'Killmail',
    'KillmailDetail',
    'Alliance',
    'AllianceDetail',
    'Corporation',
    'CorporationDetail',
    'Character',
    'CharacterDetail',
    'Type',
    'TypeDetail',
    'Category',
    'CategoryDetail',
    'ItemGroup',
    'ItemGroupDetail',
    'Region',
    'RegionDetail',
    'Constellation',
    'ConstellationDetail',
    'SolarSystem',
    'SolarSystemDetail',
] as const;

/**
 * TTL per GraphQL schema coordinate (Query field)
 * More specific than operation-based TTL
 */
export const TTL_PER_SCHEMA_COORDINATE: Record<string, number> = {
    // Killmail queries
    'Query.killmail': CACHE_TTL.KILLMAIL_DETAIL,
    'Query.killmailDetail': CACHE_TTL.KILLMAIL_DETAIL,
    'Query.killmails': CACHE_TTL.KILLMAIL_LIST,
    'Query.killmailsDateCounts': CACHE_TTL.KILLMAIL_LIST, // Same as killmails list

    // Static game data queries
    'Query.type': CACHE_TTL.STATIC_GAME_DATA,
    'Query.typeDetail': CACHE_TTL.STATIC_GAME_DATA,
    'Query.category': CACHE_TTL.STATIC_GAME_DATA,
    'Query.categoryDetail': CACHE_TTL.STATIC_GAME_DATA,
    'Query.itemGroup': CACHE_TTL.STATIC_GAME_DATA,
    'Query.itemGroupDetail': CACHE_TTL.STATIC_GAME_DATA,
    'Query.types': CACHE_TTL.STATIC_GAME_DATA,
    'Query.categories': CACHE_TTL.STATIC_GAME_DATA,
    'Query.itemGroups': CACHE_TTL.STATIC_GAME_DATA,

    // Dogma static data queries (never change)
    'Query.dogmaAttribute': CACHE_TTL.STATIC_GAME_DATA,
    'Query.dogmaAttributes': CACHE_TTL.STATIC_GAME_DATA,
    'Query.dogmaEffect': CACHE_TTL.STATIC_GAME_DATA,
    'Query.dogmaEffects': CACHE_TTL.STATIC_GAME_DATA,

    // Entity info queries
    'Query.character': CACHE_TTL.ENTITY_INFO,
    'Query.characterDetail': CACHE_TTL.ENTITY_INFO,
    'Query.corporation': CACHE_TTL.ENTITY_INFO,
    'Query.corporationDetail': CACHE_TTL.ENTITY_INFO,
    'Query.alliance': CACHE_TTL.ENTITY_INFO,
    'Query.allianceDetail': CACHE_TTL.ENTITY_INFO,

    // Geo queries
    'Query.region': CACHE_TTL.STATIC_GAME_DATA,
    'Query.regions': CACHE_TTL.STATIC_GAME_DATA,
    'Query.constellation': CACHE_TTL.STATIC_GAME_DATA,
    'Query.constellations': CACHE_TTL.STATIC_GAME_DATA,
    'Query.solarSystem': CACHE_TTL.STATIC_GAME_DATA,
    'Query.solarSystems': CACHE_TTL.STATIC_GAME_DATA,
};

/**
 * Maximum TTL for sanity check (1 year for static data)
 */
export const MAX_CACHE_TTL_SECONDS = 31536000; // 365 days

/**
 * Redis connection configuration
 */
export const REDIS_CONFIG = {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableReadyCheck: true,
    connectTimeout: 10000, // 10 seconds
    retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
} as const;
