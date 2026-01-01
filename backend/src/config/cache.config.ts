/**
 * Cache Configuration Constants
 */

/**
 * Cache TTL values in milliseconds
 */
export const CACHE_TTL = {
  /** Killmail details never change */
  KILLMAIL_DETAIL: 3600_000, // 1 hour

  /** Static game data (types, categories, groups) */
  STATIC_GAME_DATA: 3600_000, // 1 hour

  /** Character/Corporation/Alliance info (updates occasionally) */
  ENTITY_INFO: 1800_000, // 30 minutes

  /** Killmails list (new killmails arrive frequently) */
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
 * Maximum TTL for sanity check (1 hour)
 */
export const MAX_CACHE_TTL_SECONDS = 3600;

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
