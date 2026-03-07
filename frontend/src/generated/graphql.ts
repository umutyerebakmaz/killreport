import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type ActiveUsersPayload = {
  __typename?: 'ActiveUsersPayload';
  count: Scalars['Int']['output'];
  timestamp: Scalars['String']['output'];
};

export type Alliance = {
  __typename?: 'Alliance';
  corporationCount: Scalars['Int']['output'];
  corporations: Array<Corporation>;
  createdBy?: Maybe<Character>;
  createdByCorporation?: Maybe<Corporation>;
  date_founded: Scalars['String']['output'];
  executor?: Maybe<Corporation>;
  faction_id?: Maybe<Scalars['Int']['output']>;
  id: Scalars['Int']['output'];
  memberCount: Scalars['Int']['output'];
  metrics?: Maybe<AllianceMetrics>;
  name: Scalars['String']['output'];
  snapshots: Array<AllianceSnapshot>;
  ticker: Scalars['String']['output'];
  topAllianceTargets: Array<AllianceTopTarget>;
  topCorporationTargets: Array<CorporationTopTarget>;
  topShipTargets: Array<ShipTopKill>;
};


export type AllianceSnapshotsArgs = {
  days?: InputMaybe<Scalars['Int']['input']>;
};


export type AllianceTopAllianceTargetsArgs = {
  filter?: InputMaybe<TopTargetFilter>;
};


export type AllianceTopCorporationTargetsArgs = {
  filter?: InputMaybe<TopTargetFilter>;
};


export type AllianceTopShipTargetsArgs = {
  filter?: InputMaybe<TopTargetFilter>;
};

export type AllianceFilter = {
  dateFoundedFrom?: InputMaybe<Scalars['String']['input']>;
  dateFoundedTo?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  orderBy?: InputMaybe<AllianceOrderBy>;
  page?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  ticker?: InputMaybe<Scalars['String']['input']>;
};

export type AllianceMetrics = {
  __typename?: 'AllianceMetrics';
  corporationCountDelta1d?: Maybe<Scalars['Int']['output']>;
  corporationCountDelta7d?: Maybe<Scalars['Int']['output']>;
  corporationCountDelta30d?: Maybe<Scalars['Int']['output']>;
  corporationCountGrowthRate1d?: Maybe<Scalars['Float']['output']>;
  corporationCountGrowthRate7d?: Maybe<Scalars['Float']['output']>;
  corporationCountGrowthRate30d?: Maybe<Scalars['Float']['output']>;
  memberCountDelta1d?: Maybe<Scalars['Int']['output']>;
  memberCountDelta7d?: Maybe<Scalars['Int']['output']>;
  memberCountDelta30d?: Maybe<Scalars['Int']['output']>;
  memberCountGrowthRate1d?: Maybe<Scalars['Float']['output']>;
  memberCountGrowthRate7d?: Maybe<Scalars['Float']['output']>;
  memberCountGrowthRate30d?: Maybe<Scalars['Float']['output']>;
};

export enum AllianceOrderBy {
  MemberCountAsc = 'memberCountAsc',
  MemberCountDesc = 'memberCountDesc',
  NameAsc = 'nameAsc',
  NameDesc = 'nameDesc'
}

export type AllianceSnapshot = {
  __typename?: 'AllianceSnapshot';
  corporationCount: Scalars['Int']['output'];
  date: Scalars['String']['output'];
  memberCount: Scalars['Int']['output'];
};

export type AllianceTopTarget = {
  __typename?: 'AllianceTopTarget';
  alliance: Alliance;
  killCount: Scalars['Int']['output'];
};

export type AlliancesResponse = {
  __typename?: 'AlliancesResponse';
  items: Array<Alliance>;
  pageInfo: PageInfo;
};

export type Attacker = {
  __typename?: 'Attacker';
  alliance?: Maybe<Alliance>;
  character?: Maybe<Character>;
  corporation?: Maybe<Corporation>;
  damageDone: Scalars['Int']['output'];
  factionId?: Maybe<Scalars['Int']['output']>;
  finalBlow: Scalars['Boolean']['output'];
  securityStatus?: Maybe<Scalars['Float']['output']>;
  shipType?: Maybe<Type>;
  weaponType?: Maybe<Type>;
};

export type AuthPayload = {
  __typename?: 'AuthPayload';
  /** JWT access token */
  accessToken: Scalars['String']['output'];
  /** Token geçerlilik süresi (saniye) */
  expiresIn: Scalars['Int']['output'];
  /** Token yenilemek için kullanılan refresh token */
  refreshToken?: Maybe<Scalars['String']['output']>;
  /** Authenticated kullanıcı bilgileri */
  user: User;
};

export type AuthUrl = {
  __typename?: 'AuthUrl';
  /** CSRF koruması için state parametresi */
  state: Scalars['String']['output'];
  /** Eve Online SSO authorization URL'i */
  url: Scalars['String']['output'];
};

export type Bloodline = {
  __typename?: 'Bloodline';
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  race: Race;
};

export type CacheOperation = {
  __typename?: 'CacheOperation';
  deletedKeys?: Maybe<Scalars['Int']['output']>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export type CacheStats = {
  __typename?: 'CacheStats';
  allianceDetailKeys: Scalars['Int']['output'];
  characterDetailKeys: Scalars['Int']['output'];
  corporationDetailKeys: Scalars['Int']['output'];
  isHealthy: Scalars['Boolean']['output'];
  killmailDetailKeys: Scalars['Int']['output'];
  memoryUsage: Scalars['String']['output'];
  responseCacheKeys: Scalars['Int']['output'];
  totalKeys: Scalars['Int']['output'];
};

export type CategoriesResponse = {
  __typename?: 'CategoriesResponse';
  items: Array<Category>;
  pageInfo: PageInfo;
};

export type Category = {
  __typename?: 'Category';
  created_at: Scalars['String']['output'];
  groups: Array<ItemGroup>;
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  published: Scalars['Boolean']['output'];
  updated_at: Scalars['String']['output'];
};

export type CategoryFilter = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  published?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};

export type Character = {
  __typename?: 'Character';
  alliance?: Maybe<Alliance>;
  birthday: Scalars['String']['output'];
  bloodline?: Maybe<Bloodline>;
  corporation?: Maybe<Corporation>;
  description?: Maybe<Scalars['String']['output']>;
  faction_id?: Maybe<Scalars['Int']['output']>;
  gender: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  race?: Maybe<Race>;
  securityStatus?: Maybe<Scalars['Float']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['String']['output']>;
};

export type CharacterFilter = {
  allianceId?: InputMaybe<Scalars['Int']['input']>;
  corporationId?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  orderBy?: InputMaybe<CharacterOrderBy>;
  page?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};

export enum CharacterOrderBy {
  NameAsc = 'nameAsc',
  NameDesc = 'nameDesc',
  SecurityStatusAsc = 'securityStatusAsc',
  SecurityStatusDesc = 'securityStatusDesc'
}

export type CharacterTopTarget = {
  __typename?: 'CharacterTopTarget';
  character: Character;
  killCount: Scalars['Int']['output'];
};

export type CharactersResponse = {
  __typename?: 'CharactersResponse';
  items: Array<Character>;
  pageInfo: PageInfo;
};

export type Constellation = {
  __typename?: 'Constellation';
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  position?: Maybe<Position>;
  region?: Maybe<Region>;
  securityStats: SecurityStats;
  solarSystemCount: Scalars['Int']['output'];
  solarSystems: Array<SolarSystem>;
};

export type ConstellationFilter = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  orderBy?: InputMaybe<ConstellationOrderBy>;
  page?: InputMaybe<Scalars['Int']['input']>;
  region_id?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};

export enum ConstellationOrderBy {
  NameAsc = 'nameAsc',
  NameDesc = 'nameDesc'
}

export type ConstellationsResponse = {
  __typename?: 'ConstellationsResponse';
  items: Array<Constellation>;
  pageInfo: PageInfo;
};

export type Corporation = {
  __typename?: 'Corporation';
  alliance?: Maybe<Alliance>;
  ceo?: Maybe<Character>;
  creator?: Maybe<Character>;
  date_founded?: Maybe<Scalars['String']['output']>;
  faction_id?: Maybe<Scalars['Int']['output']>;
  id: Scalars['Int']['output'];
  member_count: Scalars['Int']['output'];
  metrics?: Maybe<CorporationMetrics>;
  name: Scalars['String']['output'];
  snapshots: Array<CorporationSnapshot>;
  tax_rate: Scalars['Float']['output'];
  ticker: Scalars['String']['output'];
  topAllianceTargets: Array<AllianceTopTarget>;
  topCorporationTargets: Array<CorporationTopTarget>;
  topShipTargets: Array<ShipTopKill>;
  url?: Maybe<Scalars['String']['output']>;
};


export type CorporationSnapshotsArgs = {
  days?: InputMaybe<Scalars['Int']['input']>;
};


export type CorporationTopAllianceTargetsArgs = {
  filter?: InputMaybe<TopTargetFilter>;
};


export type CorporationTopCorporationTargetsArgs = {
  filter?: InputMaybe<TopTargetFilter>;
};


export type CorporationTopShipTargetsArgs = {
  filter?: InputMaybe<TopTargetFilter>;
};

export type CorporationFilter = {
  allianceId?: InputMaybe<Scalars['Int']['input']>;
  dateFoundedFrom?: InputMaybe<Scalars['String']['input']>;
  dateFoundedTo?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  orderBy?: InputMaybe<CorporationOrderBy>;
  page?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  ticker?: InputMaybe<Scalars['String']['input']>;
};

export type CorporationMetrics = {
  __typename?: 'CorporationMetrics';
  memberCountDelta1d?: Maybe<Scalars['Int']['output']>;
  memberCountDelta7d?: Maybe<Scalars['Int']['output']>;
  memberCountDelta30d?: Maybe<Scalars['Int']['output']>;
  memberCountGrowthRate1d?: Maybe<Scalars['Float']['output']>;
  memberCountGrowthRate7d?: Maybe<Scalars['Float']['output']>;
  memberCountGrowthRate30d?: Maybe<Scalars['Float']['output']>;
};

export enum CorporationOrderBy {
  MemberCountAsc = 'memberCountAsc',
  MemberCountDesc = 'memberCountDesc',
  NameAsc = 'nameAsc',
  NameDesc = 'nameDesc'
}

export type CorporationSnapshot = {
  __typename?: 'CorporationSnapshot';
  date: Scalars['String']['output'];
  memberCount: Scalars['Int']['output'];
};

export type CorporationTopTarget = {
  __typename?: 'CorporationTopTarget';
  corporation: Corporation;
  killCount: Scalars['Int']['output'];
};

export type CorporationsResponse = {
  __typename?: 'CorporationsResponse';
  items: Array<Corporation>;
  pageInfo: PageInfo;
};

export type CreateUserInput = {
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
  email: Scalars['String']['input'];
  name: Scalars['String']['input'];
};

export type CreateUserPayload = {
  __typename?: 'CreateUserPayload';
  clientMutationId?: Maybe<Scalars['String']['output']>;
  user?: Maybe<User>;
};

export type DogmaAttribute = {
  __typename?: 'DogmaAttribute';
  created_at: Scalars['String']['output'];
  default_value?: Maybe<Scalars['Float']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  display_name?: Maybe<Scalars['String']['output']>;
  high_is_good: Scalars['Boolean']['output'];
  icon_id?: Maybe<Scalars['Int']['output']>;
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  published: Scalars['Boolean']['output'];
  stackable: Scalars['Boolean']['output'];
  unit_id?: Maybe<Scalars['Int']['output']>;
  updated_at: Scalars['String']['output'];
};

export type DogmaAttributeFilter = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  published?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};

export type DogmaAttributesResponse = {
  __typename?: 'DogmaAttributesResponse';
  items: Array<DogmaAttribute>;
  pageInfo: PageInfo;
};

export type DogmaEffect = {
  __typename?: 'DogmaEffect';
  created_at: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  disallow_auto_repeat: Scalars['Boolean']['output'];
  display_name?: Maybe<Scalars['String']['output']>;
  effect_category?: Maybe<Scalars['Int']['output']>;
  icon_id?: Maybe<Scalars['Int']['output']>;
  id: Scalars['Int']['output'];
  is_assistance: Scalars['Boolean']['output'];
  is_offensive: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  post_expression?: Maybe<Scalars['Int']['output']>;
  pre_expression?: Maybe<Scalars['Int']['output']>;
  published: Scalars['Boolean']['output'];
  updated_at: Scalars['String']['output'];
};

export type DogmaEffectFilter = {
  effect_category?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  published?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};

export type DogmaEffectsResponse = {
  __typename?: 'DogmaEffectsResponse';
  items: Array<DogmaEffect>;
  pageInfo: PageInfo;
};

/**
 * Organized fitting data for a ship
 * Groups modules, rigs, and subsystems by their slot types
 */
export type Fitting = {
  __typename?: 'Fitting';
  cargo: Array<FittingModule>;
  coreRoom: Array<FittingModule>;
  droneBay: Array<FittingModule>;
  fighterBay: Array<FittingModule>;
  fleetHangar: Array<FittingModule>;
  highSlots: SlotGroup;
  implants: SlotGroup;
  lowSlots: SlotGroup;
  midSlots: SlotGroup;
  rigs: SlotGroup;
  serviceSlots: SlotGroup;
  structureFuel: Array<FittingModule>;
  subsystems: SlotGroup;
};

/** Represents a fitted module or item */
export type FittingModule = {
  __typename?: 'FittingModule';
  charge?: Maybe<FittingModule>;
  flag: Scalars['Int']['output'];
  itemType: Type;
  quantityDestroyed?: Maybe<Scalars['Int']['output']>;
  quantityDropped?: Maybe<Scalars['Int']['output']>;
  singleton: Scalars['Int']['output'];
};

/**
 * Represents a single slot (e.g., High Slot 0)
 * Contains the module fitted in that slot and its charge (if any)
 */
export type FittingSlot = {
  __typename?: 'FittingSlot';
  module?: Maybe<FittingModule>;
  slotIndex: Scalars['Int']['output'];
};

export type ItemGroup = {
  __typename?: 'ItemGroup';
  category: Category;
  created_at: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  published: Scalars['Boolean']['output'];
  types: Array<Type>;
  updated_at: Scalars['String']['output'];
};

export type ItemGroupFilter = {
  category_id?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  published?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};

export type ItemGroupsResponse = {
  __typename?: 'ItemGroupsResponse';
  items: Array<ItemGroup>;
  pageInfo: PageInfo;
};

export type JitaPrice = {
  __typename?: 'JitaPrice';
  /** Average of buy and sell */
  average: Scalars['Float']['output'];
  /** Highest buy order (instant sell price) */
  buy: Scalars['Float']['output'];
  /** Lowest sell order (instant buy price) */
  sell: Scalars['Float']['output'];
  /** Data source timestamp */
  updatedAt: Scalars['String']['output'];
  /** Total market volume */
  volume?: Maybe<Scalars['Float']['output']>;
};

export type Killmail = {
  __typename?: 'Killmail';
  attackerCount: Scalars['Int']['output'];
  attackers: Array<Attacker>;
  createdAt: Scalars['String']['output'];
  destroyedValue?: Maybe<Scalars['Float']['output']>;
  droppedValue?: Maybe<Scalars['Float']['output']>;
  finalBlow?: Maybe<Attacker>;
  fitting?: Maybe<Fitting>;
  id: Scalars['ID']['output'];
  items: Array<KillmailItem>;
  killmailHash: Scalars['String']['output'];
  killmailTime: Scalars['String']['output'];
  npc: Scalars['Boolean']['output'];
  solarSystem: SolarSystem;
  solo: Scalars['Boolean']['output'];
  totalValue?: Maybe<Scalars['Float']['output']>;
  victim?: Maybe<Victim>;
};

export type KillmailDateCount = {
  __typename?: 'KillmailDateCount';
  count: Scalars['Int']['output'];
  date: Scalars['String']['output'];
};

export type KillmailFilter = {
  allianceId?: InputMaybe<Scalars['Int']['input']>;
  attacker?: InputMaybe<Scalars['Boolean']['input']>;
  characterAttacker?: InputMaybe<Scalars['Boolean']['input']>;
  characterId?: InputMaybe<Scalars['Int']['input']>;
  characterVictim?: InputMaybe<Scalars['Boolean']['input']>;
  constellationId?: InputMaybe<Scalars['Int']['input']>;
  corporationId?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  maxAttackers?: InputMaybe<Scalars['Int']['input']>;
  maxValue?: InputMaybe<Scalars['Float']['input']>;
  minAttackers?: InputMaybe<Scalars['Int']['input']>;
  minValue?: InputMaybe<Scalars['Float']['input']>;
  orderBy?: InputMaybe<KillmailOrderBy>;
  page?: InputMaybe<Scalars['Int']['input']>;
  regionId?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  securitySpace?: InputMaybe<Scalars['String']['input']>;
  shipGroupIds?: InputMaybe<Array<Scalars['Int']['input']>>;
  shipTypeId?: InputMaybe<Scalars['Int']['input']>;
  systemId?: InputMaybe<Scalars['Int']['input']>;
  victim?: InputMaybe<Scalars['Boolean']['input']>;
};

export type KillmailItem = {
  __typename?: 'KillmailItem';
  charge?: Maybe<KillmailItem>;
  flag: Scalars['Int']['output'];
  itemType: Type;
  quantityDestroyed?: Maybe<Scalars['Int']['output']>;
  quantityDropped?: Maybe<Scalars['Int']['output']>;
  singleton: Scalars['Int']['output'];
};

export enum KillmailOrderBy {
  TimeAsc = 'timeAsc',
  TimeDesc = 'timeDesc'
}

export type KillmailsResponse = {
  __typename?: 'KillmailsResponse';
  items: Array<Killmail>;
  pageInfo: PageInfo;
};

export type Mutation = {
  __typename?: 'Mutation';
  _empty?: Maybe<Scalars['String']['output']>;
  /** Authorization code ile authentication yapar ve token döner */
  authenticateWithCode: AuthPayload;
  /** Clear all killmail caches (use after large data updates) */
  clearAllKillmailCaches: CacheOperation;
  /** Clear cache for a specific alliance */
  clearAllianceCache: CacheOperation;
  /** Clear cache for a specific character */
  clearCharacterCache: CacheOperation;
  /** Clear cache for a specific corporation */
  clearCorporationCache: CacheOperation;
  /** Clear cache for a specific killmail */
  clearKillmailCache: CacheOperation;
  createUser: CreateUserPayload;
  /** Eve Online SSO login için authorization URL'i oluşturur */
  login: AuthUrl;
  refreshCharacter: RefreshCharacterResult;
  /** Refresh token kullanarak yeni access token alır */
  refreshToken: AuthPayload;
  startAllianceSync: StartAllianceSyncPayload;
  startCategorySync: StartCategorySyncPayload;
  startConstellationSync: StartConstellationSyncPayload;
  startDogmaAttributeSync: StartDogmaAttributeSyncPayload;
  startDogmaEffectSync: StartDogmaEffectSyncPayload;
  startItemGroupSync: StartItemGroupSyncPayload;
  startRegionSync: StartRegionSyncPayload;
  startTypeDogmaSync: StartTypeDogmaSyncPayload;
  startTypeSync: StartTypeSyncPayload;
  /**
   * Fetches user's killmails from ESI and saves to database
   * Requires: Authentication
   */
  syncMyKillmails: SyncMyKillmailsPayload;
  updateUser: UpdateUserPayload;
};


export type MutationAuthenticateWithCodeArgs = {
  code: Scalars['String']['input'];
  state: Scalars['String']['input'];
};


export type MutationClearAllianceCacheArgs = {
  allianceId: Scalars['Int']['input'];
};


export type MutationClearCharacterCacheArgs = {
  characterId: Scalars['Int']['input'];
};


export type MutationClearCorporationCacheArgs = {
  corporationId: Scalars['Int']['input'];
};


export type MutationClearKillmailCacheArgs = {
  killmailId: Scalars['Int']['input'];
};


export type MutationCreateUserArgs = {
  input: CreateUserInput;
};


export type MutationRefreshCharacterArgs = {
  characterId: Scalars['Int']['input'];
};


export type MutationRefreshTokenArgs = {
  refreshToken: Scalars['String']['input'];
};


export type MutationStartAllianceSyncArgs = {
  input: StartAllianceSyncInput;
};


export type MutationStartCategorySyncArgs = {
  input: StartCategorySyncInput;
};


export type MutationStartConstellationSyncArgs = {
  input: StartConstellationSyncInput;
};


export type MutationStartDogmaAttributeSyncArgs = {
  input: StartDogmaAttributeSyncInput;
};


export type MutationStartDogmaEffectSyncArgs = {
  input: StartDogmaEffectSyncInput;
};


export type MutationStartItemGroupSyncArgs = {
  input: StartItemGroupSyncInput;
};


export type MutationStartRegionSyncArgs = {
  input: StartRegionSyncInput;
};


export type MutationStartTypeDogmaSyncArgs = {
  input: StartTypeDogmaSyncInput;
};


export type MutationStartTypeSyncArgs = {
  input: StartTypeSyncInput;
};


export type MutationSyncMyKillmailsArgs = {
  input: SyncMyKillmailsInput;
};


export type MutationUpdateUserArgs = {
  input: UpdateUserInput;
};

/** Offset-based pagination info (page number + limit) */
export type PageInfo = {
  __typename?: 'PageInfo';
  currentPage: Scalars['Int']['output'];
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  totalCount: Scalars['Int']['output'];
  totalPages: Scalars['Int']['output'];
};

export type Position = {
  __typename?: 'Position';
  x: Scalars['Float']['output'];
  y: Scalars['Float']['output'];
  z: Scalars['Float']['output'];
};

export type Query = {
  __typename?: 'Query';
  _empty?: Maybe<Scalars['String']['output']>;
  activeUsersCount: Scalars['Int']['output'];
  alliance?: Maybe<Alliance>;
  allianceTopAllianceTargets: Array<AllianceTopTarget>;
  allianceTopCharacters: Array<CharacterTopTarget>;
  allianceTopCorporationTargets: Array<CorporationTopTarget>;
  allianceTopShipTargets: Array<ShipTopKill>;
  allianceTopShips: Array<ShipTopKill>;
  alliances: AlliancesResponse;
  bloodline?: Maybe<Bloodline>;
  bloodlines: Array<Bloodline>;
  /** Cache statistics and memory usage */
  cacheStats: CacheStats;
  categories: CategoriesResponse;
  category?: Maybe<Category>;
  character?: Maybe<Character>;
  characterTopAllianceTargets: Array<AllianceTopTarget>;
  characterTopCorporationTargets: Array<CorporationTopTarget>;
  characterTopShipTargets: Array<ShipTopKill>;
  characterTopShips: Array<ShipTopKill>;
  characters: CharactersResponse;
  constellation?: Maybe<Constellation>;
  constellations: ConstellationsResponse;
  corporation?: Maybe<Corporation>;
  corporationTopAllianceTargets: Array<AllianceTopTarget>;
  corporationTopCharacters: Array<CharacterTopTarget>;
  corporationTopCorporationTargets: Array<CorporationTopTarget>;
  corporationTopShipTargets: Array<ShipTopKill>;
  corporationTopShips: Array<ShipTopKill>;
  corporations: CorporationsResponse;
  dogmaAttribute?: Maybe<DogmaAttribute>;
  dogmaAttributes: DogmaAttributesResponse;
  dogmaEffect?: Maybe<DogmaEffect>;
  dogmaEffects: DogmaEffectsResponse;
  itemGroup?: Maybe<ItemGroup>;
  itemGroups: ItemGroupsResponse;
  /** Fetches a single killmail */
  killmail?: Maybe<Killmail>;
  /** Lists all killmails with pagination */
  killmails: KillmailsResponse;
  /** Returns count of killmails grouped by date (for the current filter) */
  killmailsDateCounts: Array<KillmailDateCount>;
  /** Mevcut authenticated kullanıcının bilgilerini döner */
  me?: Maybe<User>;
  race?: Maybe<Race>;
  races: Array<Race>;
  region?: Maybe<Region>;
  regions: RegionsResponse;
  solarSystem?: Maybe<SolarSystem>;
  solarSystems: SolarSystemsResponse;
  /** Returns top pilots ranked by total kill count over the last 90 days (rolling window) */
  top90DaysPilots: Array<Top90DaysPilot>;
  /** Returns top alliances ranked by total kill count over the last 7 days (rolling window, today - 6 days) */
  topLast7DaysAlliances: Array<TopLast7DaysAlliance>;
  /** Returns top attacker ship types by usage count over the last 7 days (rolling window, today - 6 days) */
  topLast7DaysAttackerShips: Array<TopLast7DaysAttackerShip>;
  /** Returns top corporations ranked by total kill count over the last 7 days (rolling window, today - 6 days) */
  topLast7DaysCorporations: Array<TopLast7DaysCorporation>;
  /** Returns top pilots ranked by total kill count over the last 7 days (rolling window, today - 6 days) */
  topLast7DaysPilots: Array<TopLast7DaysPilot>;
  /** Returns top ship types ranked by total kill count over the last 7 days (rolling window, today - 6 days) */
  topLast7DaysShips: Array<TopLast7DaysShip>;
  /** Returns top pilots ranked by total kill count for a given calendar month (default: current month) */
  topMonthlyPilots: Array<TopMonthlyPilot>;
  /** Returns top pilots ranked by kill count for a given day (default: today) */
  topPilots: Array<TopPilot>;
  /** Returns top pilots ranked by total kill count for a given week (Mon–Sun); defaults to current week */
  topWeeklyPilots: Array<TopWeeklyPilot>;
  type?: Maybe<Type>;
  types: TypesResponse;
  user?: Maybe<User>;
  users: Array<User>;
  /** Get current status of all workers and queues */
  workerStatus: WorkerStatus;
};


export type QueryAllianceArgs = {
  id: Scalars['Int']['input'];
};


export type QueryAllianceTopAllianceTargetsArgs = {
  allianceId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
};


export type QueryAllianceTopCharactersArgs = {
  allianceId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
};


export type QueryAllianceTopCorporationTargetsArgs = {
  allianceId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
};


export type QueryAllianceTopShipTargetsArgs = {
  allianceId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
};


export type QueryAllianceTopShipsArgs = {
  allianceId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
};


export type QueryAlliancesArgs = {
  filter?: InputMaybe<AllianceFilter>;
};


export type QueryBloodlineArgs = {
  id: Scalars['Int']['input'];
};


export type QueryCategoriesArgs = {
  filter?: InputMaybe<CategoryFilter>;
};


export type QueryCategoryArgs = {
  id: Scalars['Int']['input'];
};


export type QueryCharacterArgs = {
  id: Scalars['Int']['input'];
};


export type QueryCharacterTopAllianceTargetsArgs = {
  characterId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
};


export type QueryCharacterTopCorporationTargetsArgs = {
  characterId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
};


export type QueryCharacterTopShipTargetsArgs = {
  characterId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
};


export type QueryCharacterTopShipsArgs = {
  characterId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
};


export type QueryCharactersArgs = {
  filter?: InputMaybe<CharacterFilter>;
};


export type QueryConstellationArgs = {
  id: Scalars['Int']['input'];
};


export type QueryConstellationsArgs = {
  filter?: InputMaybe<ConstellationFilter>;
};


export type QueryCorporationArgs = {
  id: Scalars['Int']['input'];
};


export type QueryCorporationTopAllianceTargetsArgs = {
  corporationId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
};


export type QueryCorporationTopCharactersArgs = {
  corporationId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
};


export type QueryCorporationTopCorporationTargetsArgs = {
  corporationId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
};


export type QueryCorporationTopShipTargetsArgs = {
  corporationId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
};


export type QueryCorporationTopShipsArgs = {
  corporationId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
};


export type QueryCorporationsArgs = {
  filter?: InputMaybe<CorporationFilter>;
};


export type QueryDogmaAttributeArgs = {
  id: Scalars['Int']['input'];
};


export type QueryDogmaAttributesArgs = {
  filter?: InputMaybe<DogmaAttributeFilter>;
};


export type QueryDogmaEffectArgs = {
  id: Scalars['Int']['input'];
};


export type QueryDogmaEffectsArgs = {
  filter?: InputMaybe<DogmaEffectFilter>;
};


export type QueryItemGroupArgs = {
  id: Scalars['Int']['input'];
};


export type QueryItemGroupsArgs = {
  filter?: InputMaybe<ItemGroupFilter>;
};


export type QueryKillmailArgs = {
  id: Scalars['ID']['input'];
};


export type QueryKillmailsArgs = {
  filter?: InputMaybe<KillmailFilter>;
};


export type QueryKillmailsDateCountsArgs = {
  filter?: InputMaybe<KillmailFilter>;
};


export type QueryRaceArgs = {
  id: Scalars['Int']['input'];
};


export type QueryRegionArgs = {
  id: Scalars['Int']['input'];
};


export type QueryRegionsArgs = {
  filter?: InputMaybe<RegionFilter>;
};


export type QuerySolarSystemArgs = {
  id: Scalars['Int']['input'];
};


export type QuerySolarSystemsArgs = {
  filter?: InputMaybe<SolarSystemFilter>;
};


export type QueryTop90DaysPilotsArgs = {
  filter?: InputMaybe<Top90DaysPilotsFilter>;
};


export type QueryTopLast7DaysAlliancesArgs = {
  filter?: InputMaybe<TopLast7DaysAlliancesFilter>;
};


export type QueryTopLast7DaysAttackerShipsArgs = {
  filter?: InputMaybe<TopLast7DaysAttackerShipsFilter>;
};


export type QueryTopLast7DaysCorporationsArgs = {
  filter?: InputMaybe<TopLast7DaysCorporationsFilter>;
};


export type QueryTopLast7DaysPilotsArgs = {
  filter?: InputMaybe<TopLast7DaysPilotsFilter>;
};


export type QueryTopLast7DaysShipsArgs = {
  filter?: InputMaybe<TopLast7DaysShipsFilter>;
};


export type QueryTopMonthlyPilotsArgs = {
  filter?: InputMaybe<TopMonthlyPilotsFilter>;
};


export type QueryTopPilotsArgs = {
  filter?: InputMaybe<TopPilotsFilter>;
};


export type QueryTopWeeklyPilotsArgs = {
  filter?: InputMaybe<TopWeeklyPilotsFilter>;
};


export type QueryTypeArgs = {
  id: Scalars['Int']['input'];
};


export type QueryTypesArgs = {
  filter?: InputMaybe<TypeFilter>;
};


export type QueryUserArgs = {
  id: Scalars['ID']['input'];
};

export type QueueStatus = {
  __typename?: 'QueueStatus';
  /** Is there at least one active consumer */
  active: Scalars['Boolean']['output'];
  /** Number of active consumers processing from this queue */
  consumerCount: Scalars['Int']['output'];
  /** Number of messages waiting to be processed */
  messageCount: Scalars['Int']['output'];
  /** Name of the queue */
  name: Scalars['String']['output'];
  /** Worker script name (e.g., worker:info:corporations) */
  workerName?: Maybe<Scalars['String']['output']>;
  /** Process ID of the running worker */
  workerPid?: Maybe<Scalars['Int']['output']>;
  /** Is the worker process running (detected via ps aux) */
  workerRunning: Scalars['Boolean']['output'];
};

export type Race = {
  __typename?: 'Race';
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
};

export type RedisMetrics = {
  __typename?: 'RedisMetrics';
  /** Commands processed per second (instantaneous) */
  commandsPerSecond: Scalars['Int']['output'];
  /** Redis connection status */
  connected: Scalars['Boolean']['output'];
  /** Connected clients count */
  connectedClients: Scalars['Int']['output'];
  /** Redis memory usage (human readable) */
  memoryUsage: Scalars['String']['output'];
  /** Total commands processed */
  totalCommandsProcessed: Scalars['Int']['output'];
  /** Number of keys in Redis */
  totalKeys: Scalars['Int']['output'];
  /** Redis uptime in seconds */
  uptimeInSeconds: Scalars['Int']['output'];
};

export type RefreshCharacterResult = {
  __typename?: 'RefreshCharacterResult';
  characterId: Scalars['Int']['output'];
  message: Scalars['String']['output'];
  queued: Scalars['Boolean']['output'];
  success: Scalars['Boolean']['output'];
};

export type Region = {
  __typename?: 'Region';
  constellationCount: Scalars['Int']['output'];
  constellations: Array<Constellation>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  securityStats: SecurityStats;
  solarSystemCount: Scalars['Int']['output'];
};

export type RegionFilter = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  orderBy?: InputMaybe<RegionOrderBy>;
  page?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};

export enum RegionOrderBy {
  NameAsc = 'nameAsc',
  NameDesc = 'nameDesc'
}

export type RegionsResponse = {
  __typename?: 'RegionsResponse';
  items: Array<Region>;
  pageInfo: PageInfo;
};

export type SecurityStats = {
  __typename?: 'SecurityStats';
  avgSecurity?: Maybe<Scalars['Float']['output']>;
  highSec: Scalars['Int']['output'];
  lowSec: Scalars['Int']['output'];
  nullSec: Scalars['Int']['output'];
  wormhole: Scalars['Int']['output'];
};

export type ShipTopKill = {
  __typename?: 'ShipTopKill';
  killCount: Scalars['Int']['output'];
  shipType: Type;
};

/** A group of slots with total slot count from dogma attributes */
export type SlotGroup = {
  __typename?: 'SlotGroup';
  slots: Array<FittingSlot>;
  totalSlots: Scalars['Int']['output'];
};

export type SolarSystem = {
  __typename?: 'SolarSystem';
  constellation?: Maybe<Constellation>;
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  position?: Maybe<Position>;
  securityStatus?: Maybe<Scalars['Float']['output']>;
  security_class?: Maybe<Scalars['String']['output']>;
  star_id?: Maybe<Scalars['Int']['output']>;
};

export type SolarSystemFilter = {
  constellation_id?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  orderBy?: InputMaybe<SolarSystemOrderBy>;
  page?: InputMaybe<Scalars['Int']['input']>;
  region_id?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  securityStatusMax?: InputMaybe<Scalars['Float']['input']>;
  securityStatusMin?: InputMaybe<Scalars['Float']['input']>;
};

export enum SolarSystemOrderBy {
  NameAsc = 'nameAsc',
  NameDesc = 'nameDesc',
  SecurityStatusAsc = 'securityStatusAsc',
  SecurityStatusDesc = 'securityStatusDesc'
}

export type SolarSystemsResponse = {
  __typename?: 'SolarSystemsResponse';
  items: Array<SolarSystem>;
  pageInfo: PageInfo;
};

export type StandaloneWorkerStatus = {
  __typename?: 'StandaloneWorkerStatus';
  /** Description of what this worker does */
  description: Scalars['String']['output'];
  /** Name of the worker */
  name: Scalars['String']['output'];
  /** Process ID if running */
  pid?: Maybe<Scalars['Int']['output']>;
  /** Is the worker currently running */
  running: Scalars['Boolean']['output'];
};

export type StartAllianceSyncInput = {
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

export type StartAllianceSyncPayload = {
  __typename?: 'StartAllianceSyncPayload';
  clientMutationId?: Maybe<Scalars['String']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type StartCategorySyncInput = {
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

export type StartCategorySyncPayload = {
  __typename?: 'StartCategorySyncPayload';
  clientMutationId?: Maybe<Scalars['String']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type StartConstellationSyncInput = {
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

export type StartConstellationSyncPayload = {
  __typename?: 'StartConstellationSyncPayload';
  clientMutationId?: Maybe<Scalars['String']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type StartDogmaAttributeSyncInput = {
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

export type StartDogmaAttributeSyncPayload = {
  __typename?: 'StartDogmaAttributeSyncPayload';
  clientMutationId?: Maybe<Scalars['String']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type StartDogmaEffectSyncInput = {
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

export type StartDogmaEffectSyncPayload = {
  __typename?: 'StartDogmaEffectSyncPayload';
  clientMutationId?: Maybe<Scalars['String']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type StartItemGroupSyncInput = {
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

export type StartItemGroupSyncPayload = {
  __typename?: 'StartItemGroupSyncPayload';
  clientMutationId?: Maybe<Scalars['String']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type StartRegionSyncInput = {
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

export type StartRegionSyncPayload = {
  __typename?: 'StartRegionSyncPayload';
  clientMutationId?: Maybe<Scalars['String']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type StartTypeDogmaSyncInput = {
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
  typeIds?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type StartTypeDogmaSyncPayload = {
  __typename?: 'StartTypeDogmaSyncPayload';
  clientMutationId?: Maybe<Scalars['String']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  queuedCount?: Maybe<Scalars['Int']['output']>;
  success: Scalars['Boolean']['output'];
};

export type StartTypeSyncInput = {
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

export type StartTypeSyncPayload = {
  __typename?: 'StartTypeSyncPayload';
  clientMutationId?: Maybe<Scalars['String']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type Subscription = {
  __typename?: 'Subscription';
  _empty?: Maybe<Scalars['String']['output']>;
  activeUsersUpdates: ActiveUsersPayload;
  /**
   * Subscribe to new killmails as they are added to the database
   * Emits a new event whenever a killmail is saved
   */
  newKillmail: Killmail;
  /**
   * Subscribe to real-time worker status updates
   * Emits updates every 5 seconds
   */
  workerStatusUpdates: WorkerStatus;
};

export type SyncMyKillmailsInput = {
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

export type SyncMyKillmailsPayload = {
  __typename?: 'SyncMyKillmailsPayload';
  clientMutationId?: Maybe<Scalars['String']['output']>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
  syncedCount: Scalars['Int']['output'];
};

export type Top90DaysPilot = {
  __typename?: 'Top90DaysPilot';
  character?: Maybe<Character>;
  killCount: Scalars['Int']['output'];
  rank: Scalars['Int']['output'];
};

export type Top90DaysPilotsFilter = {
  /** Max 100; default 100 */
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type TopLast7DaysAlliance = {
  __typename?: 'TopLast7DaysAlliance';
  alliance?: Maybe<Alliance>;
  killCount: Scalars['Int']['output'];
  rank: Scalars['Int']['output'];
};

export type TopLast7DaysAlliancesFilter = {
  /** Filter by constellation ID */
  constellationId?: InputMaybe<Scalars['Int']['input']>;
  /** Max 100; default 100 */
  limit?: InputMaybe<Scalars['Int']['input']>;
  /** Filter by region ID */
  regionId?: InputMaybe<Scalars['Int']['input']>;
  /** Filter by solar system ID */
  systemId?: InputMaybe<Scalars['Int']['input']>;
};

export type TopLast7DaysAttackerShip = {
  __typename?: 'TopLast7DaysAttackerShip';
  killCount: Scalars['Int']['output'];
  rank: Scalars['Int']['output'];
  shipType?: Maybe<Type>;
};

export type TopLast7DaysAttackerShipsFilter = {
  /** Max 100; default 100 */
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type TopLast7DaysCorporation = {
  __typename?: 'TopLast7DaysCorporation';
  corporation?: Maybe<Corporation>;
  killCount: Scalars['Int']['output'];
  rank: Scalars['Int']['output'];
};

export type TopLast7DaysCorporationsFilter = {
  /** Filter by constellation ID */
  constellationId?: InputMaybe<Scalars['Int']['input']>;
  /** Max 100; default 100 */
  limit?: InputMaybe<Scalars['Int']['input']>;
  /** Filter by region ID */
  regionId?: InputMaybe<Scalars['Int']['input']>;
  /** Filter by solar system ID */
  systemId?: InputMaybe<Scalars['Int']['input']>;
};

export type TopLast7DaysPilot = {
  __typename?: 'TopLast7DaysPilot';
  character?: Maybe<Character>;
  killCount: Scalars['Int']['output'];
  rank: Scalars['Int']['output'];
};

export type TopLast7DaysPilotsFilter = {
  /** Filter by constellation ID */
  constellationId?: InputMaybe<Scalars['Int']['input']>;
  /** Max 100; default 100 */
  limit?: InputMaybe<Scalars['Int']['input']>;
  /** Filter by region ID */
  regionId?: InputMaybe<Scalars['Int']['input']>;
  /** Filter by solar system ID */
  systemId?: InputMaybe<Scalars['Int']['input']>;
};

export type TopLast7DaysShip = {
  __typename?: 'TopLast7DaysShip';
  killCount: Scalars['Int']['output'];
  rank: Scalars['Int']['output'];
  shipType?: Maybe<Type>;
};

export type TopLast7DaysShipsFilter = {
  /** Filter by constellation ID */
  constellationId?: InputMaybe<Scalars['Int']['input']>;
  /** Max 100; default 100 */
  limit?: InputMaybe<Scalars['Int']['input']>;
  /** Filter by region ID */
  regionId?: InputMaybe<Scalars['Int']['input']>;
  /** Filter by solar system ID */
  systemId?: InputMaybe<Scalars['Int']['input']>;
};

export type TopMonthlyPilot = {
  __typename?: 'TopMonthlyPilot';
  character?: Maybe<Character>;
  killCount: Scalars['Int']['output'];
  rank: Scalars['Int']['output'];
};

export type TopMonthlyPilotsFilter = {
  /** Max 100; default 100 */
  limit?: InputMaybe<Scalars['Int']['input']>;
  /** Year-month string YYYY-MM; defaults to current month (UTC) */
  month?: InputMaybe<Scalars['String']['input']>;
};

export type TopPilot = {
  __typename?: 'TopPilot';
  character?: Maybe<Character>;
  killCount: Scalars['Int']['output'];
  rank: Scalars['Int']['output'];
};

export type TopPilotsFilter = {
  /** ISO date string YYYY-MM-DD; defaults to today (UTC) */
  date?: InputMaybe<Scalars['String']['input']>;
  /** Max 100; default 100 */
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export enum TopTargetFilter {
  AllTime = 'ALL_TIME',
  Last_7Days = 'LAST_7_DAYS',
  Last_90Days = 'LAST_90_DAYS',
  Today = 'TODAY'
}

export type TopWeeklyPilot = {
  __typename?: 'TopWeeklyPilot';
  character?: Maybe<Character>;
  killCount: Scalars['Int']['output'];
  rank: Scalars['Int']['output'];
};

export type TopWeeklyPilotsFilter = {
  /** Max 100; default 100 */
  limit?: InputMaybe<Scalars['Int']['input']>;
  /** ISO date string YYYY-MM-DD for the Monday (start) of the week; defaults to current week's Monday (UTC) */
  weekStart?: InputMaybe<Scalars['String']['input']>;
};

export type Type = {
  __typename?: 'Type';
  capacity?: Maybe<Scalars['Float']['output']>;
  created_at: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  dogmaAttributes: Array<TypeDogmaAttribute>;
  dogmaEffects: Array<TypeDogmaEffect>;
  group?: Maybe<ItemGroup>;
  icon_id?: Maybe<Scalars['Int']['output']>;
  id: Scalars['Int']['output'];
  /** Jita market price (cached, updates every 4 hours) */
  jitaPrice?: Maybe<JitaPrice>;
  mass?: Maybe<Scalars['Float']['output']>;
  name: Scalars['String']['output'];
  published: Scalars['Boolean']['output'];
  updated_at: Scalars['String']['output'];
  volume?: Maybe<Scalars['Float']['output']>;
};


export type TypeDogmaAttributesArgs = {
  ids?: InputMaybe<Array<Scalars['Int']['input']>>;
};


export type TypeDogmaEffectsArgs = {
  ids?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type TypeDogmaAttribute = {
  __typename?: 'TypeDogmaAttribute';
  attribute: DogmaAttribute;
  attribute_id: Scalars['Int']['output'];
  type_id: Scalars['Int']['output'];
  value: Scalars['Float']['output'];
};

export type TypeDogmaEffect = {
  __typename?: 'TypeDogmaEffect';
  effect: DogmaEffect;
  effect_id: Scalars['Int']['output'];
  is_default: Scalars['Boolean']['output'];
  type_id: Scalars['Int']['output'];
};

export type TypeFilter = {
  categoryList?: InputMaybe<Array<Scalars['Int']['input']>>;
  groupList?: InputMaybe<Array<Scalars['Int']['input']>>;
  group_id?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  published?: InputMaybe<Scalars['Boolean']['input']>;
};

export type TypesResponse = {
  __typename?: 'TypesResponse';
  items: Array<Type>;
  pageInfo: PageInfo;
};

export type UpdateUserInput = {
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateUserPayload = {
  __typename?: 'UpdateUserPayload';
  clientMutationId?: Maybe<Scalars['String']['output']>;
  user?: Maybe<User>;
};

export type User = {
  __typename?: 'User';
  createdAt: Scalars['String']['output'];
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type Victim = {
  __typename?: 'Victim';
  alliance?: Maybe<Alliance>;
  character?: Maybe<Character>;
  corporation?: Maybe<Corporation>;
  damageTaken: Scalars['Int']['output'];
  factionId?: Maybe<Scalars['Int']['output']>;
  position?: Maybe<Position>;
  shipType: Type;
};

export type WorkerStatus = {
  __typename?: 'WorkerStatus';
  /** Database size in megabytes (MB) */
  databaseSizeMB: Scalars['Float']['output'];
  /** Overall system health */
  healthy: Scalars['Boolean']['output'];
  /** Status of individual queues (RabbitMQ-based workers) */
  queues: Array<QueueStatus>;
  /** Redis server metrics */
  redis?: Maybe<RedisMetrics>;
  /** Status of standalone workers (non-RabbitMQ) */
  standaloneWorkers: Array<StandaloneWorkerStatus>;
  /** Timestamp of the status check */
  timestamp: Scalars['String']['output'];
};

export type AllianceQueryVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type AllianceQuery = { __typename?: 'Query', alliance?: { __typename?: 'Alliance', id: number, name: string, ticker: string, date_founded: string, memberCount: number, corporationCount: number, metrics?: { __typename?: 'AllianceMetrics', memberCountDelta7d?: number | null, corporationCountDelta7d?: number | null, memberCountGrowthRate7d?: number | null, corporationCountGrowthRate7d?: number | null } | null, executor?: { __typename?: 'Corporation', id: number, name: string } | null, createdByCorporation?: { __typename?: 'Corporation', id: number, name: string } | null, createdBy?: { __typename?: 'Character', id: number, name: string } | null } | null };

export type AllianceGrowthQueryVariables = Exact<{
  id: Scalars['Int']['input'];
  days?: InputMaybe<Scalars['Int']['input']>;
}>;


export type AllianceGrowthQuery = { __typename?: 'Query', alliance?: { __typename?: 'Alliance', id: number, snapshots: Array<{ __typename?: 'AllianceSnapshot', date: string, memberCount: number, corporationCount: number }> } | null };

export type AllianceCorporationsQueryVariables = Exact<{
  filter?: InputMaybe<CorporationFilter>;
}>;


export type AllianceCorporationsQuery = { __typename?: 'Query', corporations: { __typename?: 'CorporationsResponse', items: Array<{ __typename?: 'Corporation', id: number, name: string, ticker: string, member_count: number, ceo?: { __typename?: 'Character', id: number, name: string } | null }>, pageInfo: { __typename?: 'PageInfo', currentPage: number, totalPages: number, totalCount: number, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type AllianceKillmailsQueryVariables = Exact<{
  filter?: InputMaybe<KillmailFilter>;
}>;


export type AllianceKillmailsQuery = { __typename?: 'Query', killmails: { __typename?: 'KillmailsResponse', items: Array<{ __typename?: 'Killmail', id: string, killmailTime: string, totalValue?: number | null, attackerCount: number, solo: boolean, npc: boolean, victim?: { __typename?: 'Victim', damageTaken: number, character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null, shipType: { __typename?: 'Type', id: number, name: string, group?: { __typename?: 'ItemGroup', name: string } | null, dogmaAttributes: Array<{ __typename?: 'TypeDogmaAttribute', attribute_id: number, value: number }> } } | null, finalBlow?: { __typename?: 'Attacker', character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null } | null, solarSystem: { __typename?: 'SolarSystem', id: number, name: string, securityStatus?: number | null, constellation?: { __typename?: 'Constellation', id: number, name: string, region?: { __typename?: 'Region', id: number, name: string } | null } | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, currentPage: number, totalPages: number, totalCount: number } } };

export type AllianceTopAllianceTargetsQueryVariables = Exact<{
  allianceId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
}>;


export type AllianceTopAllianceTargetsQuery = { __typename?: 'Query', allianceTopAllianceTargets: Array<{ __typename?: 'AllianceTopTarget', killCount: number, alliance: { __typename?: 'Alliance', id: number, name: string, ticker: string } }> };

export type AllianceTopCorporationTargetsQueryVariables = Exact<{
  allianceId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
}>;


export type AllianceTopCorporationTargetsQuery = { __typename?: 'Query', allianceTopCorporationTargets: Array<{ __typename?: 'CorporationTopTarget', killCount: number, corporation: { __typename?: 'Corporation', id: number, name: string, ticker: string } }> };

export type AllianceTopShipTargetsQueryVariables = Exact<{
  allianceId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
}>;


export type AllianceTopShipTargetsQuery = { __typename?: 'Query', allianceTopShipTargets: Array<{ __typename?: 'ShipTopKill', killCount: number, shipType: { __typename?: 'Type', id: number, name: string, dogmaAttributes: Array<{ __typename?: 'TypeDogmaAttribute', attribute_id: number, value: number }> } }> };

export type AllianceTopShipsQueryVariables = Exact<{
  allianceId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
}>;


export type AllianceTopShipsQuery = { __typename?: 'Query', allianceTopShips: Array<{ __typename?: 'ShipTopKill', killCount: number, shipType: { __typename?: 'Type', id: number, name: string, dogmaAttributes: Array<{ __typename?: 'TypeDogmaAttribute', attribute_id: number, value: number }> } }> };

export type AllianceTopCharactersQueryVariables = Exact<{
  allianceId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
}>;


export type AllianceTopCharactersQuery = { __typename?: 'Query', allianceTopCharacters: Array<{ __typename?: 'CharacterTopTarget', killCount: number, character: { __typename?: 'Character', id: number, name: string, securityStatus?: number | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null } }> };

export type AlliancesQueryVariables = Exact<{
  filter?: InputMaybe<AllianceFilter>;
}>;


export type AlliancesQuery = { __typename?: 'Query', alliances: { __typename?: 'AlliancesResponse', items: Array<{ __typename?: 'Alliance', id: number, name: string, ticker: string, date_founded: string, memberCount: number, corporationCount: number, metrics?: { __typename?: 'AllianceMetrics', memberCountDelta7d?: number | null, corporationCountDelta7d?: number | null, memberCountGrowthRate7d?: number | null } | null }>, pageInfo: { __typename?: 'PageInfo', currentPage: number, totalPages: number, totalCount: number, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type ActiveUsersUpdatesSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type ActiveUsersUpdatesSubscription = { __typename?: 'Subscription', activeUsersUpdates: { __typename?: 'ActiveUsersPayload', count: number, timestamp: string } };

export type ActiveUsersCountQueryVariables = Exact<{ [key: string]: never; }>;


export type ActiveUsersCountQuery = { __typename?: 'Query', activeUsersCount: number };

export type RefreshTokenMutationVariables = Exact<{
  refreshToken: Scalars['String']['input'];
}>;


export type RefreshTokenMutation = { __typename?: 'Mutation', refreshToken: { __typename?: 'AuthPayload', accessToken: string, refreshToken?: string | null, expiresIn: number, user: { __typename?: 'User', id: string, name: string, email: string, createdAt: string } } };

export type CharacterQueryVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type CharacterQuery = { __typename?: 'Query', character?: { __typename?: 'Character', id: number, name: string, birthday: string, securityStatus?: number | null, description?: string | null, title?: string | null, updatedAt?: string | null, corporation?: { __typename?: 'Corporation', id: number, name: string, ticker: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string, ticker: string } | null } | null };

export type CharacterKillmailsQueryVariables = Exact<{
  filter?: InputMaybe<KillmailFilter>;
}>;


export type CharacterKillmailsQuery = { __typename?: 'Query', killmails: { __typename?: 'KillmailsResponse', items: Array<{ __typename?: 'Killmail', id: string, killmailTime: string, totalValue?: number | null, attackerCount: number, solo: boolean, npc: boolean, victim?: { __typename?: 'Victim', damageTaken: number, character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null, shipType: { __typename?: 'Type', id: number, name: string, group?: { __typename?: 'ItemGroup', name: string } | null, dogmaAttributes: Array<{ __typename?: 'TypeDogmaAttribute', attribute_id: number, value: number }> } } | null, finalBlow?: { __typename?: 'Attacker', character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null } | null, solarSystem: { __typename?: 'SolarSystem', id: number, name: string, securityStatus?: number | null, constellation?: { __typename?: 'Constellation', id: number, name: string, region?: { __typename?: 'Region', id: number, name: string } | null } | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, currentPage: number, totalPages: number, totalCount: number } } };

export type CharacterTopAllianceTargetsQueryVariables = Exact<{
  characterId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
}>;


export type CharacterTopAllianceTargetsQuery = { __typename?: 'Query', characterTopAllianceTargets: Array<{ __typename?: 'AllianceTopTarget', killCount: number, alliance: { __typename?: 'Alliance', id: number, name: string, ticker: string } }> };

export type CharacterTopCorporationTargetsQueryVariables = Exact<{
  characterId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
}>;


export type CharacterTopCorporationTargetsQuery = { __typename?: 'Query', characterTopCorporationTargets: Array<{ __typename?: 'CorporationTopTarget', killCount: number, corporation: { __typename?: 'Corporation', id: number, name: string, ticker: string } }> };

export type CharacterTopShipTargetsQueryVariables = Exact<{
  characterId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
}>;


export type CharacterTopShipTargetsQuery = { __typename?: 'Query', characterTopShipTargets: Array<{ __typename?: 'ShipTopKill', killCount: number, shipType: { __typename?: 'Type', id: number, name: string, dogmaAttributes: Array<{ __typename?: 'TypeDogmaAttribute', attribute_id: number, value: number }> } }> };

export type CharacterTopShipsQueryVariables = Exact<{
  characterId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
}>;


export type CharacterTopShipsQuery = { __typename?: 'Query', characterTopShips: Array<{ __typename?: 'ShipTopKill', killCount: number, shipType: { __typename?: 'Type', id: number, name: string, dogmaAttributes: Array<{ __typename?: 'TypeDogmaAttribute', attribute_id: number, value: number }> } }> };

export type CharactersQueryVariables = Exact<{
  filter?: InputMaybe<CharacterFilter>;
}>;


export type CharactersQuery = { __typename?: 'Query', characters: { __typename?: 'CharactersResponse', items: Array<{ __typename?: 'Character', id: number, name: string, securityStatus?: number | null, corporation?: { __typename?: 'Corporation', id: number, name: string, ticker: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string, ticker: string } | null }>, pageInfo: { __typename?: 'PageInfo', currentPage: number, totalPages: number, totalCount: number, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type ConstellationsQueryVariables = Exact<{
  filter?: InputMaybe<ConstellationFilter>;
}>;


export type ConstellationsQuery = { __typename?: 'Query', constellations: { __typename?: 'ConstellationsResponse', items: Array<{ __typename?: 'Constellation', id: number, name: string, solarSystemCount: number, securityStats: { __typename?: 'SecurityStats', highSec: number, lowSec: number, nullSec: number, wormhole: number, avgSecurity?: number | null }, region?: { __typename?: 'Region', id: number, name: string } | null }>, pageInfo: { __typename?: 'PageInfo', currentPage: number, totalPages: number, totalCount: number, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type ConstellationQueryVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type ConstellationQuery = { __typename?: 'Query', constellation?: { __typename?: 'Constellation', id: number, name: string, solarSystemCount: number, securityStats: { __typename?: 'SecurityStats', highSec: number, lowSec: number, nullSec: number, wormhole: number, avgSecurity?: number | null }, position?: { __typename?: 'Position', x: number, y: number, z: number } | null, region?: { __typename?: 'Region', id: number, name: string } | null, solarSystems: Array<{ __typename?: 'SolarSystem', id: number, name: string, securityStatus?: number | null, security_class?: string | null }> } | null };

export type CorporationQueryVariables = Exact<{
  id: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
}>;


export type CorporationQuery = { __typename?: 'Query', corporation?: { __typename?: 'Corporation', id: number, name: string, ticker: string, date_founded?: string | null, member_count: number, tax_rate: number, url?: string | null, alliance?: { __typename?: 'Alliance', id: number, name: string, ticker: string } | null, ceo?: { __typename?: 'Character', id: number, name: string } | null, creator?: { __typename?: 'Character', id: number, name: string } | null, metrics?: { __typename?: 'CorporationMetrics', memberCountDelta7d?: number | null, memberCountGrowthRate7d?: number | null } | null, topShipTargets: Array<{ __typename?: 'ShipTopKill', killCount: number, shipType: { __typename?: 'Type', id: number, name: string } }>, topAllianceTargets: Array<{ __typename?: 'AllianceTopTarget', killCount: number, alliance: { __typename?: 'Alliance', id: number, name: string, ticker: string } }>, topCorporationTargets: Array<{ __typename?: 'CorporationTopTarget', killCount: number, corporation: { __typename?: 'Corporation', id: number, name: string, ticker: string } }> } | null };

export type CorporationGrowthQueryVariables = Exact<{
  id: Scalars['Int']['input'];
  days?: InputMaybe<Scalars['Int']['input']>;
}>;


export type CorporationGrowthQuery = { __typename?: 'Query', corporation?: { __typename?: 'Corporation', id: number, snapshots: Array<{ __typename?: 'CorporationSnapshot', date: string, memberCount: number }> } | null };

export type CorporationCharactersQueryVariables = Exact<{
  filter?: InputMaybe<CharacterFilter>;
}>;


export type CorporationCharactersQuery = { __typename?: 'Query', characters: { __typename?: 'CharactersResponse', items: Array<{ __typename?: 'Character', id: number, name: string, securityStatus?: number | null }>, pageInfo: { __typename?: 'PageInfo', currentPage: number, totalPages: number, totalCount: number, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type CorporationKillmailsQueryVariables = Exact<{
  filter?: InputMaybe<KillmailFilter>;
}>;


export type CorporationKillmailsQuery = { __typename?: 'Query', killmails: { __typename?: 'KillmailsResponse', items: Array<{ __typename?: 'Killmail', id: string, killmailTime: string, totalValue?: number | null, attackerCount: number, solo: boolean, npc: boolean, victim?: { __typename?: 'Victim', damageTaken: number, character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null, shipType: { __typename?: 'Type', id: number, name: string, group?: { __typename?: 'ItemGroup', name: string } | null, dogmaAttributes: Array<{ __typename?: 'TypeDogmaAttribute', attribute_id: number, value: number }> } } | null, finalBlow?: { __typename?: 'Attacker', character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null } | null, solarSystem: { __typename?: 'SolarSystem', id: number, name: string, securityStatus?: number | null, constellation?: { __typename?: 'Constellation', id: number, name: string, region?: { __typename?: 'Region', id: number, name: string } | null } | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, currentPage: number, totalPages: number, totalCount: number } } };

export type CorporationTopAllianceTargetsQueryVariables = Exact<{
  corporationId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
}>;


export type CorporationTopAllianceTargetsQuery = { __typename?: 'Query', corporationTopAllianceTargets: Array<{ __typename?: 'AllianceTopTarget', killCount: number, alliance: { __typename?: 'Alliance', id: number, name: string, ticker: string } }> };

export type CorporationTopCorporationTargetsQueryVariables = Exact<{
  corporationId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
}>;


export type CorporationTopCorporationTargetsQuery = { __typename?: 'Query', corporationTopCorporationTargets: Array<{ __typename?: 'CorporationTopTarget', killCount: number, corporation: { __typename?: 'Corporation', id: number, name: string, ticker: string } }> };

export type CorporationTopShipTargetsQueryVariables = Exact<{
  corporationId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
}>;


export type CorporationTopShipTargetsQuery = { __typename?: 'Query', corporationTopShipTargets: Array<{ __typename?: 'ShipTopKill', killCount: number, shipType: { __typename?: 'Type', id: number, name: string, dogmaAttributes: Array<{ __typename?: 'TypeDogmaAttribute', attribute_id: number, value: number }> } }> };

export type CorporationTopShipsQueryVariables = Exact<{
  corporationId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
}>;


export type CorporationTopShipsQuery = { __typename?: 'Query', corporationTopShips: Array<{ __typename?: 'ShipTopKill', killCount: number, shipType: { __typename?: 'Type', id: number, name: string, dogmaAttributes: Array<{ __typename?: 'TypeDogmaAttribute', attribute_id: number, value: number }> } }> };

export type CorporationTopCharactersQueryVariables = Exact<{
  corporationId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
}>;


export type CorporationTopCharactersQuery = { __typename?: 'Query', corporationTopCharacters: Array<{ __typename?: 'CharacterTopTarget', killCount: number, character: { __typename?: 'Character', id: number, name: string, securityStatus?: number | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null } }> };

export type CorporationsQueryVariables = Exact<{
  filter?: InputMaybe<CorporationFilter>;
}>;


export type CorporationsQuery = { __typename?: 'Query', corporations: { __typename?: 'CorporationsResponse', items: Array<{ __typename?: 'Corporation', id: number, name: string, ticker: string, member_count: number, date_founded?: string | null, alliance?: { __typename?: 'Alliance', id: number, name: string, ticker: string } | null, metrics?: { __typename?: 'CorporationMetrics', memberCountDelta1d?: number | null, memberCountDelta7d?: number | null, memberCountDelta30d?: number | null, memberCountGrowthRate1d?: number | null, memberCountGrowthRate7d?: number | null, memberCountGrowthRate30d?: number | null } | null }>, pageInfo: { __typename?: 'PageInfo', currentPage: number, totalPages: number, totalCount: number, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type KillmailQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type KillmailQuery = { __typename?: 'Query', killmail?: { __typename?: 'Killmail', id: string, killmailHash: string, killmailTime: string, destroyedValue?: number | null, droppedValue?: number | null, totalValue?: number | null, attackerCount: number, solo: boolean, npc: boolean, solarSystem: { __typename?: 'SolarSystem', id: number, name: string, securityStatus?: number | null, constellation?: { __typename?: 'Constellation', id: number, name: string, region?: { __typename?: 'Region', id: number, name: string } | null } | null }, victim?: { __typename?: 'Victim', damageTaken: number, character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string, ticker: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string, ticker: string } | null, shipType: { __typename?: 'Type', id: number, name: string, description?: string | null, dogmaAttributes: Array<{ __typename?: 'TypeDogmaAttribute', attribute_id: number, value: number }>, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string, category: { __typename?: 'Category', name: string } } | null } } | null, attackers: Array<{ __typename?: 'Attacker', damageDone: number, finalBlow: boolean, securityStatus?: number | null, character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null, shipType?: { __typename?: 'Type', id: number, name: string, dogmaAttributes: Array<{ __typename?: 'TypeDogmaAttribute', attribute_id: number, value: number }>, group?: { __typename?: 'ItemGroup', name: string } | null } | null, weaponType?: { __typename?: 'Type', id: number, name: string } | null }>, fitting?: { __typename?: 'Fitting', highSlots: { __typename?: 'SlotGroup', totalSlots: number, slots: Array<{ __typename?: 'FittingSlot', slotIndex: number, module?: { __typename?: 'FittingModule', flag: number, singleton: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string } | null }, charge?: { __typename?: 'FittingModule', singleton: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string } | null } } | null } | null }> }, midSlots: { __typename?: 'SlotGroup', totalSlots: number, slots: Array<{ __typename?: 'FittingSlot', slotIndex: number, module?: { __typename?: 'FittingModule', flag: number, singleton: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string } | null }, charge?: { __typename?: 'FittingModule', singleton: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string } | null } } | null } | null }> }, lowSlots: { __typename?: 'SlotGroup', totalSlots: number, slots: Array<{ __typename?: 'FittingSlot', slotIndex: number, module?: { __typename?: 'FittingModule', flag: number, singleton: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string } | null }, charge?: { __typename?: 'FittingModule', singleton: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string } | null } } | null } | null }> }, rigs: { __typename?: 'SlotGroup', totalSlots: number, slots: Array<{ __typename?: 'FittingSlot', slotIndex: number, module?: { __typename?: 'FittingModule', flag: number, singleton: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string } | null } } | null }> }, subsystems: { __typename?: 'SlotGroup', totalSlots: number, slots: Array<{ __typename?: 'FittingSlot', slotIndex: number, module?: { __typename?: 'FittingModule', flag: number, singleton: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string } | null } } | null }> }, serviceSlots: { __typename?: 'SlotGroup', totalSlots: number, slots: Array<{ __typename?: 'FittingSlot', slotIndex: number, module?: { __typename?: 'FittingModule', flag: number, singleton: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string } | null } } | null }> }, implants: { __typename?: 'SlotGroup', totalSlots: number, slots: Array<{ __typename?: 'FittingSlot', slotIndex: number, module?: { __typename?: 'FittingModule', singleton: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string } | null } } | null }> }, cargo: Array<{ __typename?: 'FittingModule', flag: number, singleton: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string, category: { __typename?: 'Category', name: string } } | null } }>, droneBay: Array<{ __typename?: 'FittingModule', flag: number, singleton: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string, category: { __typename?: 'Category', name: string } } | null } }>, fleetHangar: Array<{ __typename?: 'FittingModule', flag: number, singleton: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string, category: { __typename?: 'Category', name: string } } | null } }>, fighterBay: Array<{ __typename?: 'FittingModule', flag: number, singleton: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string, category: { __typename?: 'Category', name: string } } | null } }>, structureFuel: Array<{ __typename?: 'FittingModule', flag: number, singleton: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string, category: { __typename?: 'Category', name: string } } | null } }>, coreRoom: Array<{ __typename?: 'FittingModule', flag: number, singleton: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string, category: { __typename?: 'Category', name: string } } | null } }> } | null } | null };

export type KillmailsQueryVariables = Exact<{
  filter?: InputMaybe<KillmailFilter>;
}>;


export type KillmailsQuery = { __typename?: 'Query', killmails: { __typename?: 'KillmailsResponse', items: Array<{ __typename?: 'Killmail', id: string, killmailTime: string, totalValue?: number | null, attackerCount: number, solo: boolean, npc: boolean, solarSystem: { __typename?: 'SolarSystem', id: number, name: string, securityStatus?: number | null, constellation?: { __typename?: 'Constellation', id: number, name: string, region?: { __typename?: 'Region', id: number, name: string } | null } | null }, victim?: { __typename?: 'Victim', damageTaken: number, character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null, shipType: { __typename?: 'Type', id: number, name: string, group?: { __typename?: 'ItemGroup', name: string } | null, dogmaAttributes: Array<{ __typename?: 'TypeDogmaAttribute', attribute_id: number, value: number }> } } | null, finalBlow?: { __typename?: 'Attacker', character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null } | null }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, currentPage: number, totalPages: number, totalCount: number } } };

export type KillmailsDateCountsQueryVariables = Exact<{
  filter?: InputMaybe<KillmailFilter>;
}>;


export type KillmailsDateCountsQuery = { __typename?: 'Query', killmailsDateCounts: Array<{ __typename?: 'KillmailDateCount', date: string, count: number }> };

export type NewKillmailSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type NewKillmailSubscription = { __typename?: 'Subscription', newKillmail: { __typename?: 'Killmail', id: string, killmailTime: string, totalValue?: number | null, attackerCount: number, solarSystem: { __typename?: 'SolarSystem', id: number, name: string, securityStatus?: number | null, constellation?: { __typename?: 'Constellation', id: number, name: string, region?: { __typename?: 'Region', name: string } | null } | null }, victim?: { __typename?: 'Victim', damageTaken: number, character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null, shipType: { __typename?: 'Type', id: number, name: string, group?: { __typename?: 'ItemGroup', name: string } | null, dogmaAttributes: Array<{ __typename?: 'TypeDogmaAttribute', attribute_id: number, value: number }> } } | null, finalBlow?: { __typename?: 'Attacker', character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null } | null } };

export type RegionsQueryVariables = Exact<{
  filter?: InputMaybe<RegionFilter>;
}>;


export type RegionsQuery = { __typename?: 'Query', regions: { __typename?: 'RegionsResponse', items: Array<{ __typename?: 'Region', id: number, name: string, description?: string | null, constellationCount: number, solarSystemCount: number, securityStats: { __typename?: 'SecurityStats', highSec: number, lowSec: number, nullSec: number, wormhole: number, avgSecurity?: number | null } }>, pageInfo: { __typename?: 'PageInfo', currentPage: number, totalPages: number, totalCount: number, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type RegionQueryVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type RegionQuery = { __typename?: 'Query', region?: { __typename?: 'Region', id: number, name: string, description?: string | null, constellationCount: number, solarSystemCount: number, securityStats: { __typename?: 'SecurityStats', highSec: number, lowSec: number, nullSec: number, wormhole: number, avgSecurity?: number | null }, constellations: Array<{ __typename?: 'Constellation', id: number, name: string, solarSystemCount: number, securityStats: { __typename?: 'SecurityStats', highSec: number, lowSec: number, nullSec: number, avgSecurity?: number | null } }> } | null };

export type SearchAlliancesQueryVariables = Exact<{
  search: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SearchAlliancesQuery = { __typename?: 'Query', alliances: { __typename?: 'AlliancesResponse', items: Array<{ __typename?: 'Alliance', id: number, name: string, ticker: string, memberCount: number, corporationCount: number }> } };

export type SearchCharacterQueryVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type SearchCharacterQuery = { __typename?: 'Query', character?: { __typename?: 'Character', id: number, name: string, corporation?: { __typename?: 'Corporation', id: number, name: string, ticker: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string, ticker: string } | null } | null };

export type SearchCharactersQueryVariables = Exact<{
  search: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SearchCharactersQuery = { __typename?: 'Query', characters: { __typename?: 'CharactersResponse', items: Array<{ __typename?: 'Character', id: number, name: string, corporation?: { __typename?: 'Corporation', id: number, name: string, ticker: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string, ticker: string } | null }> } };

export type SearchConstellationQueryVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type SearchConstellationQuery = { __typename?: 'Query', constellation?: { __typename?: 'Constellation', id: number, name: string, region?: { __typename?: 'Region', id: number, name: string } | null } | null };

export type SearchConstellationsQueryVariables = Exact<{
  search: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SearchConstellationsQuery = { __typename?: 'Query', constellations: { __typename?: 'ConstellationsResponse', items: Array<{ __typename?: 'Constellation', id: number, name: string, solarSystemCount: number, securityStats: { __typename?: 'SecurityStats', highSec: number, lowSec: number, nullSec: number, wormhole: number, avgSecurity?: number | null }, region?: { __typename?: 'Region', id: number, name: string } | null }> } };

export type SearchCorporationsQueryVariables = Exact<{
  search: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SearchCorporationsQuery = { __typename?: 'Query', corporations: { __typename?: 'CorporationsResponse', items: Array<{ __typename?: 'Corporation', id: number, name: string, ticker: string, member_count: number, alliance?: { __typename?: 'Alliance', id: number, name: string, ticker: string } | null }> } };

export type SearchItemGroupsQueryVariables = Exact<{
  search: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SearchItemGroupsQuery = { __typename?: 'Query', itemGroups: { __typename?: 'ItemGroupsResponse', items: Array<{ __typename?: 'ItemGroup', id: number, name: string, category: { __typename?: 'Category', id: number, name: string } }> } };

export type SearchItemGroupQueryVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type SearchItemGroupQuery = { __typename?: 'Query', itemGroup?: { __typename?: 'ItemGroup', id: number, name: string, category: { __typename?: 'Category', id: number, name: string } } | null };

export type SearchRegionQueryVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type SearchRegionQuery = { __typename?: 'Query', region?: { __typename?: 'Region', id: number, name: string } | null };

export type SearchRegionsQueryVariables = Exact<{
  search: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SearchRegionsQuery = { __typename?: 'Query', regions: { __typename?: 'RegionsResponse', items: Array<{ __typename?: 'Region', id: number, name: string, solarSystemCount: number, constellationCount: number, securityStats: { __typename?: 'SecurityStats', highSec: number, lowSec: number, nullSec: number, wormhole: number, avgSecurity?: number | null } }> } };

export type SearchSolarSystemQueryVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type SearchSolarSystemQuery = { __typename?: 'Query', solarSystem?: { __typename?: 'SolarSystem', id: number, name: string, securityStatus?: number | null, constellation?: { __typename?: 'Constellation', id: number, name: string } | null } | null };

export type SearchSolarSystemsQueryVariables = Exact<{
  search: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SearchSolarSystemsQuery = { __typename?: 'Query', solarSystems: { __typename?: 'SolarSystemsResponse', items: Array<{ __typename?: 'SolarSystem', id: number, name: string, securityStatus?: number | null, security_class?: string | null, constellation?: { __typename?: 'Constellation', id: number, name: string, region?: { __typename?: 'Region', id: number, name: string } | null } | null }> } };

export type SearchTypeQueryVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type SearchTypeQuery = { __typename?: 'Query', type?: { __typename?: 'Type', id: number, name: string, group?: { __typename?: 'ItemGroup', id: number, name: string } | null } | null };

export type SearchTypesQueryVariables = Exact<{
  name: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SearchTypesQuery = { __typename?: 'Query', types: { __typename?: 'TypesResponse', items: Array<{ __typename?: 'Type', id: number, name: string, group?: { __typename?: 'ItemGroup', id: number, name: string } | null }> } };

export type SolarSystemsQueryVariables = Exact<{
  filter?: InputMaybe<SolarSystemFilter>;
}>;


export type SolarSystemsQuery = { __typename?: 'Query', solarSystems: { __typename?: 'SolarSystemsResponse', items: Array<{ __typename?: 'SolarSystem', id: number, name: string, securityStatus?: number | null, constellation?: { __typename?: 'Constellation', id: number, name: string, region?: { __typename?: 'Region', id: number, name: string } | null } | null }>, pageInfo: { __typename?: 'PageInfo', currentPage: number, totalPages: number, totalCount: number, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type SolarSystemQueryVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type SolarSystemQuery = { __typename?: 'Query', solarSystem?: { __typename?: 'SolarSystem', id: number, name: string, securityStatus?: number | null, security_class?: string | null, star_id?: number | null, position?: { __typename?: 'Position', x: number, y: number, z: number } | null, constellation?: { __typename?: 'Constellation', id: number, name: string, region?: { __typename?: 'Region', id: number, name: string } | null } | null } | null };

export type Top90DaysPilotsQueryVariables = Exact<{
  filter?: InputMaybe<Top90DaysPilotsFilter>;
}>;


export type Top90DaysPilotsQuery = { __typename?: 'Query', top90DaysPilots: Array<{ __typename?: 'Top90DaysPilot', rank: number, killCount: number, character?: { __typename?: 'Character', id: number, name: string, securityStatus?: number | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null } | null }> };

export type TopLast7DaysAlliancesQueryVariables = Exact<{
  filter?: InputMaybe<TopLast7DaysAlliancesFilter>;
}>;


export type TopLast7DaysAlliancesQuery = { __typename?: 'Query', topLast7DaysAlliances: Array<{ __typename?: 'TopLast7DaysAlliance', rank: number, killCount: number, alliance?: { __typename?: 'Alliance', id: number, name: string, ticker: string } | null }> };

export type TopLast7DaysAttackerShipsQueryVariables = Exact<{
  filter?: InputMaybe<TopLast7DaysAttackerShipsFilter>;
}>;


export type TopLast7DaysAttackerShipsQuery = { __typename?: 'Query', topLast7DaysAttackerShips: Array<{ __typename?: 'TopLast7DaysAttackerShip', rank: number, killCount: number, shipType?: { __typename?: 'Type', id: number, name: string, dogmaAttributes: Array<{ __typename?: 'TypeDogmaAttribute', attribute_id: number, value: number }> } | null }> };

export type TopLast7DaysCorporationsQueryVariables = Exact<{
  filter?: InputMaybe<TopLast7DaysCorporationsFilter>;
}>;


export type TopLast7DaysCorporationsQuery = { __typename?: 'Query', topLast7DaysCorporations: Array<{ __typename?: 'TopLast7DaysCorporation', rank: number, killCount: number, corporation?: { __typename?: 'Corporation', id: number, name: string, ticker: string } | null }> };

export type TopLast7DaysPilotsQueryVariables = Exact<{
  filter?: InputMaybe<TopLast7DaysPilotsFilter>;
}>;


export type TopLast7DaysPilotsQuery = { __typename?: 'Query', topLast7DaysPilots: Array<{ __typename?: 'TopLast7DaysPilot', rank: number, killCount: number, character?: { __typename?: 'Character', id: number, name: string, securityStatus?: number | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null } | null }> };

export type TopLast7DaysShipsQueryVariables = Exact<{
  filter?: InputMaybe<TopLast7DaysShipsFilter>;
}>;


export type TopLast7DaysShipsQuery = { __typename?: 'Query', topLast7DaysShips: Array<{ __typename?: 'TopLast7DaysShip', rank: number, killCount: number, shipType?: { __typename?: 'Type', id: number, name: string, dogmaAttributes: Array<{ __typename?: 'TypeDogmaAttribute', attribute_id: number, value: number }> } | null }> };

export type TopMonthlyPilotsQueryVariables = Exact<{
  filter?: InputMaybe<TopMonthlyPilotsFilter>;
}>;


export type TopMonthlyPilotsQuery = { __typename?: 'Query', topMonthlyPilots: Array<{ __typename?: 'TopMonthlyPilot', rank: number, killCount: number, character?: { __typename?: 'Character', id: number, name: string, securityStatus?: number | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null } | null }> };

export type TopPilotsQueryVariables = Exact<{
  filter?: InputMaybe<TopPilotsFilter>;
}>;


export type TopPilotsQuery = { __typename?: 'Query', topPilots: Array<{ __typename?: 'TopPilot', rank: number, killCount: number, character?: { __typename?: 'Character', id: number, name: string, securityStatus?: number | null, corporation?: { __typename?: 'Corporation', id: number, name: string, ticker: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string, ticker: string } | null } | null }> };

export type TopWeeklyPilotsQueryVariables = Exact<{
  filter?: InputMaybe<TopWeeklyPilotsFilter>;
}>;


export type TopWeeklyPilotsQuery = { __typename?: 'Query', topWeeklyPilots: Array<{ __typename?: 'TopWeeklyPilot', rank: number, killCount: number, character?: { __typename?: 'Character', id: number, name: string, securityStatus?: number | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null } | null }> };

export type WorkerStatusSubscriptionSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type WorkerStatusSubscriptionSubscription = { __typename?: 'Subscription', workerStatusUpdates: { __typename?: 'WorkerStatus', timestamp: string, healthy: boolean, databaseSizeMB: number, redis?: { __typename?: 'RedisMetrics', connected: boolean, memoryUsage: string, totalKeys: number, connectedClients: number, totalCommandsProcessed: number, commandsPerSecond: number, uptimeInSeconds: number } | null, queues: Array<{ __typename?: 'QueueStatus', name: string, messageCount: number, consumerCount: number, active: boolean, workerRunning: boolean, workerPid?: number | null, workerName?: string | null }>, standaloneWorkers: Array<{ __typename?: 'StandaloneWorkerStatus', name: string, running: boolean, pid?: number | null, description: string }> } };

export type WorkerStatusUpdatesSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type WorkerStatusUpdatesSubscription = { __typename?: 'Subscription', workerStatusUpdates: { __typename?: 'WorkerStatus', timestamp: string, healthy: boolean, databaseSizeMB: number, redis?: { __typename?: 'RedisMetrics', memoryUsage: string, totalKeys: number, connectedClients: number, uptimeInSeconds: number } | null, queues: Array<{ __typename?: 'QueueStatus', name: string, messageCount: number, consumerCount: number, active: boolean }> } };

export type WorkerStatusQueryVariables = Exact<{ [key: string]: never; }>;


export type WorkerStatusQuery = { __typename?: 'Query', workerStatus: { __typename?: 'WorkerStatus', timestamp: string, healthy: boolean, queues: Array<{ __typename?: 'QueueStatus', name: string, messageCount: number, consumerCount: number, active: boolean }> } };


export const AllianceDocument = gql`
    query Alliance($id: Int!) {
  alliance(id: $id) {
    id
    name
    ticker
    date_founded
    memberCount
    corporationCount
    metrics {
      memberCountDelta7d
      corporationCountDelta7d
      memberCountGrowthRate7d
      corporationCountGrowthRate7d
    }
    executor {
      id
      name
    }
    createdByCorporation {
      id
      name
    }
    createdBy {
      id
      name
    }
  }
}
    `;

/**
 * __useAllianceQuery__
 *
 * To run a query within a React component, call `useAllianceQuery` and pass it any options that fit your needs.
 * When your component renders, `useAllianceQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAllianceQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useAllianceQuery(baseOptions: Apollo.QueryHookOptions<AllianceQuery, AllianceQueryVariables> & ({ variables: AllianceQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<AllianceQuery, AllianceQueryVariables>(AllianceDocument, options);
      }
export function useAllianceLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<AllianceQuery, AllianceQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<AllianceQuery, AllianceQueryVariables>(AllianceDocument, options);
        }
// @ts-ignore
export function useAllianceSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<AllianceQuery, AllianceQueryVariables>): Apollo.UseSuspenseQueryResult<AllianceQuery, AllianceQueryVariables>;
export function useAllianceSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AllianceQuery, AllianceQueryVariables>): Apollo.UseSuspenseQueryResult<AllianceQuery | undefined, AllianceQueryVariables>;
export function useAllianceSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AllianceQuery, AllianceQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<AllianceQuery, AllianceQueryVariables>(AllianceDocument, options);
        }
export type AllianceQueryHookResult = ReturnType<typeof useAllianceQuery>;
export type AllianceLazyQueryHookResult = ReturnType<typeof useAllianceLazyQuery>;
export type AllianceSuspenseQueryHookResult = ReturnType<typeof useAllianceSuspenseQuery>;
export type AllianceQueryResult = Apollo.QueryResult<AllianceQuery, AllianceQueryVariables>;
export const AllianceGrowthDocument = gql`
    query AllianceGrowth($id: Int!, $days: Int) {
  alliance(id: $id) {
    id
    snapshots(days: $days) {
      date
      memberCount
      corporationCount
    }
  }
}
    `;

/**
 * __useAllianceGrowthQuery__
 *
 * To run a query within a React component, call `useAllianceGrowthQuery` and pass it any options that fit your needs.
 * When your component renders, `useAllianceGrowthQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAllianceGrowthQuery({
 *   variables: {
 *      id: // value for 'id'
 *      days: // value for 'days'
 *   },
 * });
 */
export function useAllianceGrowthQuery(baseOptions: Apollo.QueryHookOptions<AllianceGrowthQuery, AllianceGrowthQueryVariables> & ({ variables: AllianceGrowthQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<AllianceGrowthQuery, AllianceGrowthQueryVariables>(AllianceGrowthDocument, options);
      }
export function useAllianceGrowthLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<AllianceGrowthQuery, AllianceGrowthQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<AllianceGrowthQuery, AllianceGrowthQueryVariables>(AllianceGrowthDocument, options);
        }
// @ts-ignore
export function useAllianceGrowthSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<AllianceGrowthQuery, AllianceGrowthQueryVariables>): Apollo.UseSuspenseQueryResult<AllianceGrowthQuery, AllianceGrowthQueryVariables>;
export function useAllianceGrowthSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AllianceGrowthQuery, AllianceGrowthQueryVariables>): Apollo.UseSuspenseQueryResult<AllianceGrowthQuery | undefined, AllianceGrowthQueryVariables>;
export function useAllianceGrowthSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AllianceGrowthQuery, AllianceGrowthQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<AllianceGrowthQuery, AllianceGrowthQueryVariables>(AllianceGrowthDocument, options);
        }
export type AllianceGrowthQueryHookResult = ReturnType<typeof useAllianceGrowthQuery>;
export type AllianceGrowthLazyQueryHookResult = ReturnType<typeof useAllianceGrowthLazyQuery>;
export type AllianceGrowthSuspenseQueryHookResult = ReturnType<typeof useAllianceGrowthSuspenseQuery>;
export type AllianceGrowthQueryResult = Apollo.QueryResult<AllianceGrowthQuery, AllianceGrowthQueryVariables>;
export const AllianceCorporationsDocument = gql`
    query AllianceCorporations($filter: CorporationFilter) {
  corporations(filter: $filter) {
    items {
      id
      name
      ticker
      member_count
      ceo {
        id
        name
      }
    }
    pageInfo {
      currentPage
      totalPages
      totalCount
      hasNextPage
      hasPreviousPage
    }
  }
}
    `;

/**
 * __useAllianceCorporationsQuery__
 *
 * To run a query within a React component, call `useAllianceCorporationsQuery` and pass it any options that fit your needs.
 * When your component renders, `useAllianceCorporationsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAllianceCorporationsQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useAllianceCorporationsQuery(baseOptions?: Apollo.QueryHookOptions<AllianceCorporationsQuery, AllianceCorporationsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<AllianceCorporationsQuery, AllianceCorporationsQueryVariables>(AllianceCorporationsDocument, options);
      }
export function useAllianceCorporationsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<AllianceCorporationsQuery, AllianceCorporationsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<AllianceCorporationsQuery, AllianceCorporationsQueryVariables>(AllianceCorporationsDocument, options);
        }
// @ts-ignore
export function useAllianceCorporationsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<AllianceCorporationsQuery, AllianceCorporationsQueryVariables>): Apollo.UseSuspenseQueryResult<AllianceCorporationsQuery, AllianceCorporationsQueryVariables>;
export function useAllianceCorporationsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AllianceCorporationsQuery, AllianceCorporationsQueryVariables>): Apollo.UseSuspenseQueryResult<AllianceCorporationsQuery | undefined, AllianceCorporationsQueryVariables>;
export function useAllianceCorporationsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AllianceCorporationsQuery, AllianceCorporationsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<AllianceCorporationsQuery, AllianceCorporationsQueryVariables>(AllianceCorporationsDocument, options);
        }
export type AllianceCorporationsQueryHookResult = ReturnType<typeof useAllianceCorporationsQuery>;
export type AllianceCorporationsLazyQueryHookResult = ReturnType<typeof useAllianceCorporationsLazyQuery>;
export type AllianceCorporationsSuspenseQueryHookResult = ReturnType<typeof useAllianceCorporationsSuspenseQuery>;
export type AllianceCorporationsQueryResult = Apollo.QueryResult<AllianceCorporationsQuery, AllianceCorporationsQueryVariables>;
export const AllianceKillmailsDocument = gql`
    query AllianceKillmails($filter: KillmailFilter) {
  killmails(filter: $filter) {
    items {
      id
      killmailTime
      totalValue
      attackerCount
      solo
      npc
      victim {
        character {
          id
          name
        }
        corporation {
          id
          name
        }
        alliance {
          id
          name
        }
        shipType {
          id
          name
          group {
            name
          }
          dogmaAttributes(ids: [422, 1692]) {
            attribute_id
            value
          }
        }
        damageTaken
      }
      finalBlow {
        character {
          id
          name
        }
        corporation {
          id
          name
        }
        alliance {
          id
          name
        }
      }
      solarSystem {
        id
        name
        securityStatus
        constellation {
          id
          name
          region {
            id
            name
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      currentPage
      totalPages
      totalCount
    }
  }
}
    `;

/**
 * __useAllianceKillmailsQuery__
 *
 * To run a query within a React component, call `useAllianceKillmailsQuery` and pass it any options that fit your needs.
 * When your component renders, `useAllianceKillmailsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAllianceKillmailsQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useAllianceKillmailsQuery(baseOptions?: Apollo.QueryHookOptions<AllianceKillmailsQuery, AllianceKillmailsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<AllianceKillmailsQuery, AllianceKillmailsQueryVariables>(AllianceKillmailsDocument, options);
      }
export function useAllianceKillmailsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<AllianceKillmailsQuery, AllianceKillmailsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<AllianceKillmailsQuery, AllianceKillmailsQueryVariables>(AllianceKillmailsDocument, options);
        }
// @ts-ignore
export function useAllianceKillmailsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<AllianceKillmailsQuery, AllianceKillmailsQueryVariables>): Apollo.UseSuspenseQueryResult<AllianceKillmailsQuery, AllianceKillmailsQueryVariables>;
export function useAllianceKillmailsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AllianceKillmailsQuery, AllianceKillmailsQueryVariables>): Apollo.UseSuspenseQueryResult<AllianceKillmailsQuery | undefined, AllianceKillmailsQueryVariables>;
export function useAllianceKillmailsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AllianceKillmailsQuery, AllianceKillmailsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<AllianceKillmailsQuery, AllianceKillmailsQueryVariables>(AllianceKillmailsDocument, options);
        }
export type AllianceKillmailsQueryHookResult = ReturnType<typeof useAllianceKillmailsQuery>;
export type AllianceKillmailsLazyQueryHookResult = ReturnType<typeof useAllianceKillmailsLazyQuery>;
export type AllianceKillmailsSuspenseQueryHookResult = ReturnType<typeof useAllianceKillmailsSuspenseQuery>;
export type AllianceKillmailsQueryResult = Apollo.QueryResult<AllianceKillmailsQuery, AllianceKillmailsQueryVariables>;
export const AllianceTopAllianceTargetsDocument = gql`
    query AllianceTopAllianceTargets($allianceId: Int!, $filter: TopTargetFilter) {
  allianceTopAllianceTargets(allianceId: $allianceId, filter: $filter) {
    killCount
    alliance {
      id
      name
      ticker
    }
  }
}
    `;

/**
 * __useAllianceTopAllianceTargetsQuery__
 *
 * To run a query within a React component, call `useAllianceTopAllianceTargetsQuery` and pass it any options that fit your needs.
 * When your component renders, `useAllianceTopAllianceTargetsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAllianceTopAllianceTargetsQuery({
 *   variables: {
 *      allianceId: // value for 'allianceId'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useAllianceTopAllianceTargetsQuery(baseOptions: Apollo.QueryHookOptions<AllianceTopAllianceTargetsQuery, AllianceTopAllianceTargetsQueryVariables> & ({ variables: AllianceTopAllianceTargetsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<AllianceTopAllianceTargetsQuery, AllianceTopAllianceTargetsQueryVariables>(AllianceTopAllianceTargetsDocument, options);
      }
export function useAllianceTopAllianceTargetsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<AllianceTopAllianceTargetsQuery, AllianceTopAllianceTargetsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<AllianceTopAllianceTargetsQuery, AllianceTopAllianceTargetsQueryVariables>(AllianceTopAllianceTargetsDocument, options);
        }
// @ts-ignore
export function useAllianceTopAllianceTargetsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<AllianceTopAllianceTargetsQuery, AllianceTopAllianceTargetsQueryVariables>): Apollo.UseSuspenseQueryResult<AllianceTopAllianceTargetsQuery, AllianceTopAllianceTargetsQueryVariables>;
export function useAllianceTopAllianceTargetsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AllianceTopAllianceTargetsQuery, AllianceTopAllianceTargetsQueryVariables>): Apollo.UseSuspenseQueryResult<AllianceTopAllianceTargetsQuery | undefined, AllianceTopAllianceTargetsQueryVariables>;
export function useAllianceTopAllianceTargetsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AllianceTopAllianceTargetsQuery, AllianceTopAllianceTargetsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<AllianceTopAllianceTargetsQuery, AllianceTopAllianceTargetsQueryVariables>(AllianceTopAllianceTargetsDocument, options);
        }
export type AllianceTopAllianceTargetsQueryHookResult = ReturnType<typeof useAllianceTopAllianceTargetsQuery>;
export type AllianceTopAllianceTargetsLazyQueryHookResult = ReturnType<typeof useAllianceTopAllianceTargetsLazyQuery>;
export type AllianceTopAllianceTargetsSuspenseQueryHookResult = ReturnType<typeof useAllianceTopAllianceTargetsSuspenseQuery>;
export type AllianceTopAllianceTargetsQueryResult = Apollo.QueryResult<AllianceTopAllianceTargetsQuery, AllianceTopAllianceTargetsQueryVariables>;
export const AllianceTopCorporationTargetsDocument = gql`
    query AllianceTopCorporationTargets($allianceId: Int!, $filter: TopTargetFilter) {
  allianceTopCorporationTargets(allianceId: $allianceId, filter: $filter) {
    killCount
    corporation {
      id
      name
      ticker
    }
  }
}
    `;

/**
 * __useAllianceTopCorporationTargetsQuery__
 *
 * To run a query within a React component, call `useAllianceTopCorporationTargetsQuery` and pass it any options that fit your needs.
 * When your component renders, `useAllianceTopCorporationTargetsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAllianceTopCorporationTargetsQuery({
 *   variables: {
 *      allianceId: // value for 'allianceId'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useAllianceTopCorporationTargetsQuery(baseOptions: Apollo.QueryHookOptions<AllianceTopCorporationTargetsQuery, AllianceTopCorporationTargetsQueryVariables> & ({ variables: AllianceTopCorporationTargetsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<AllianceTopCorporationTargetsQuery, AllianceTopCorporationTargetsQueryVariables>(AllianceTopCorporationTargetsDocument, options);
      }
export function useAllianceTopCorporationTargetsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<AllianceTopCorporationTargetsQuery, AllianceTopCorporationTargetsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<AllianceTopCorporationTargetsQuery, AllianceTopCorporationTargetsQueryVariables>(AllianceTopCorporationTargetsDocument, options);
        }
// @ts-ignore
export function useAllianceTopCorporationTargetsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<AllianceTopCorporationTargetsQuery, AllianceTopCorporationTargetsQueryVariables>): Apollo.UseSuspenseQueryResult<AllianceTopCorporationTargetsQuery, AllianceTopCorporationTargetsQueryVariables>;
export function useAllianceTopCorporationTargetsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AllianceTopCorporationTargetsQuery, AllianceTopCorporationTargetsQueryVariables>): Apollo.UseSuspenseQueryResult<AllianceTopCorporationTargetsQuery | undefined, AllianceTopCorporationTargetsQueryVariables>;
export function useAllianceTopCorporationTargetsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AllianceTopCorporationTargetsQuery, AllianceTopCorporationTargetsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<AllianceTopCorporationTargetsQuery, AllianceTopCorporationTargetsQueryVariables>(AllianceTopCorporationTargetsDocument, options);
        }
export type AllianceTopCorporationTargetsQueryHookResult = ReturnType<typeof useAllianceTopCorporationTargetsQuery>;
export type AllianceTopCorporationTargetsLazyQueryHookResult = ReturnType<typeof useAllianceTopCorporationTargetsLazyQuery>;
export type AllianceTopCorporationTargetsSuspenseQueryHookResult = ReturnType<typeof useAllianceTopCorporationTargetsSuspenseQuery>;
export type AllianceTopCorporationTargetsQueryResult = Apollo.QueryResult<AllianceTopCorporationTargetsQuery, AllianceTopCorporationTargetsQueryVariables>;
export const AllianceTopShipTargetsDocument = gql`
    query AllianceTopShipTargets($allianceId: Int!, $filter: TopTargetFilter) {
  allianceTopShipTargets(allianceId: $allianceId, filter: $filter) {
    killCount
    shipType {
      id
      name
      dogmaAttributes(ids: [422, 1692]) {
        attribute_id
        value
      }
    }
  }
}
    `;

/**
 * __useAllianceTopShipTargetsQuery__
 *
 * To run a query within a React component, call `useAllianceTopShipTargetsQuery` and pass it any options that fit your needs.
 * When your component renders, `useAllianceTopShipTargetsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAllianceTopShipTargetsQuery({
 *   variables: {
 *      allianceId: // value for 'allianceId'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useAllianceTopShipTargetsQuery(baseOptions: Apollo.QueryHookOptions<AllianceTopShipTargetsQuery, AllianceTopShipTargetsQueryVariables> & ({ variables: AllianceTopShipTargetsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<AllianceTopShipTargetsQuery, AllianceTopShipTargetsQueryVariables>(AllianceTopShipTargetsDocument, options);
      }
export function useAllianceTopShipTargetsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<AllianceTopShipTargetsQuery, AllianceTopShipTargetsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<AllianceTopShipTargetsQuery, AllianceTopShipTargetsQueryVariables>(AllianceTopShipTargetsDocument, options);
        }
// @ts-ignore
export function useAllianceTopShipTargetsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<AllianceTopShipTargetsQuery, AllianceTopShipTargetsQueryVariables>): Apollo.UseSuspenseQueryResult<AllianceTopShipTargetsQuery, AllianceTopShipTargetsQueryVariables>;
export function useAllianceTopShipTargetsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AllianceTopShipTargetsQuery, AllianceTopShipTargetsQueryVariables>): Apollo.UseSuspenseQueryResult<AllianceTopShipTargetsQuery | undefined, AllianceTopShipTargetsQueryVariables>;
export function useAllianceTopShipTargetsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AllianceTopShipTargetsQuery, AllianceTopShipTargetsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<AllianceTopShipTargetsQuery, AllianceTopShipTargetsQueryVariables>(AllianceTopShipTargetsDocument, options);
        }
export type AllianceTopShipTargetsQueryHookResult = ReturnType<typeof useAllianceTopShipTargetsQuery>;
export type AllianceTopShipTargetsLazyQueryHookResult = ReturnType<typeof useAllianceTopShipTargetsLazyQuery>;
export type AllianceTopShipTargetsSuspenseQueryHookResult = ReturnType<typeof useAllianceTopShipTargetsSuspenseQuery>;
export type AllianceTopShipTargetsQueryResult = Apollo.QueryResult<AllianceTopShipTargetsQuery, AllianceTopShipTargetsQueryVariables>;
export const AllianceTopShipsDocument = gql`
    query AllianceTopShips($allianceId: Int!, $filter: TopTargetFilter) {
  allianceTopShips(allianceId: $allianceId, filter: $filter) {
    killCount
    shipType {
      id
      name
      dogmaAttributes(ids: [422, 1692]) {
        attribute_id
        value
      }
    }
  }
}
    `;

/**
 * __useAllianceTopShipsQuery__
 *
 * To run a query within a React component, call `useAllianceTopShipsQuery` and pass it any options that fit your needs.
 * When your component renders, `useAllianceTopShipsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAllianceTopShipsQuery({
 *   variables: {
 *      allianceId: // value for 'allianceId'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useAllianceTopShipsQuery(baseOptions: Apollo.QueryHookOptions<AllianceTopShipsQuery, AllianceTopShipsQueryVariables> & ({ variables: AllianceTopShipsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<AllianceTopShipsQuery, AllianceTopShipsQueryVariables>(AllianceTopShipsDocument, options);
      }
export function useAllianceTopShipsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<AllianceTopShipsQuery, AllianceTopShipsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<AllianceTopShipsQuery, AllianceTopShipsQueryVariables>(AllianceTopShipsDocument, options);
        }
// @ts-ignore
export function useAllianceTopShipsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<AllianceTopShipsQuery, AllianceTopShipsQueryVariables>): Apollo.UseSuspenseQueryResult<AllianceTopShipsQuery, AllianceTopShipsQueryVariables>;
export function useAllianceTopShipsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AllianceTopShipsQuery, AllianceTopShipsQueryVariables>): Apollo.UseSuspenseQueryResult<AllianceTopShipsQuery | undefined, AllianceTopShipsQueryVariables>;
export function useAllianceTopShipsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AllianceTopShipsQuery, AllianceTopShipsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<AllianceTopShipsQuery, AllianceTopShipsQueryVariables>(AllianceTopShipsDocument, options);
        }
export type AllianceTopShipsQueryHookResult = ReturnType<typeof useAllianceTopShipsQuery>;
export type AllianceTopShipsLazyQueryHookResult = ReturnType<typeof useAllianceTopShipsLazyQuery>;
export type AllianceTopShipsSuspenseQueryHookResult = ReturnType<typeof useAllianceTopShipsSuspenseQuery>;
export type AllianceTopShipsQueryResult = Apollo.QueryResult<AllianceTopShipsQuery, AllianceTopShipsQueryVariables>;
export const AllianceTopCharactersDocument = gql`
    query AllianceTopCharacters($allianceId: Int!, $filter: TopTargetFilter) {
  allianceTopCharacters(allianceId: $allianceId, filter: $filter) {
    killCount
    character {
      id
      name
      securityStatus
      corporation {
        id
        name
      }
      alliance {
        id
        name
      }
    }
  }
}
    `;

/**
 * __useAllianceTopCharactersQuery__
 *
 * To run a query within a React component, call `useAllianceTopCharactersQuery` and pass it any options that fit your needs.
 * When your component renders, `useAllianceTopCharactersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAllianceTopCharactersQuery({
 *   variables: {
 *      allianceId: // value for 'allianceId'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useAllianceTopCharactersQuery(baseOptions: Apollo.QueryHookOptions<AllianceTopCharactersQuery, AllianceTopCharactersQueryVariables> & ({ variables: AllianceTopCharactersQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<AllianceTopCharactersQuery, AllianceTopCharactersQueryVariables>(AllianceTopCharactersDocument, options);
      }
export function useAllianceTopCharactersLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<AllianceTopCharactersQuery, AllianceTopCharactersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<AllianceTopCharactersQuery, AllianceTopCharactersQueryVariables>(AllianceTopCharactersDocument, options);
        }
// @ts-ignore
export function useAllianceTopCharactersSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<AllianceTopCharactersQuery, AllianceTopCharactersQueryVariables>): Apollo.UseSuspenseQueryResult<AllianceTopCharactersQuery, AllianceTopCharactersQueryVariables>;
export function useAllianceTopCharactersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AllianceTopCharactersQuery, AllianceTopCharactersQueryVariables>): Apollo.UseSuspenseQueryResult<AllianceTopCharactersQuery | undefined, AllianceTopCharactersQueryVariables>;
export function useAllianceTopCharactersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AllianceTopCharactersQuery, AllianceTopCharactersQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<AllianceTopCharactersQuery, AllianceTopCharactersQueryVariables>(AllianceTopCharactersDocument, options);
        }
export type AllianceTopCharactersQueryHookResult = ReturnType<typeof useAllianceTopCharactersQuery>;
export type AllianceTopCharactersLazyQueryHookResult = ReturnType<typeof useAllianceTopCharactersLazyQuery>;
export type AllianceTopCharactersSuspenseQueryHookResult = ReturnType<typeof useAllianceTopCharactersSuspenseQuery>;
export type AllianceTopCharactersQueryResult = Apollo.QueryResult<AllianceTopCharactersQuery, AllianceTopCharactersQueryVariables>;
export const AlliancesDocument = gql`
    query Alliances($filter: AllianceFilter) {
  alliances(filter: $filter) {
    items {
      id
      name
      ticker
      date_founded
      memberCount
      corporationCount
      metrics {
        memberCountDelta7d
        corporationCountDelta7d
        memberCountGrowthRate7d
      }
    }
    pageInfo {
      currentPage
      totalPages
      totalCount
      hasNextPage
      hasPreviousPage
    }
  }
}
    `;

/**
 * __useAlliancesQuery__
 *
 * To run a query within a React component, call `useAlliancesQuery` and pass it any options that fit your needs.
 * When your component renders, `useAlliancesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAlliancesQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useAlliancesQuery(baseOptions?: Apollo.QueryHookOptions<AlliancesQuery, AlliancesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<AlliancesQuery, AlliancesQueryVariables>(AlliancesDocument, options);
      }
export function useAlliancesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<AlliancesQuery, AlliancesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<AlliancesQuery, AlliancesQueryVariables>(AlliancesDocument, options);
        }
// @ts-ignore
export function useAlliancesSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<AlliancesQuery, AlliancesQueryVariables>): Apollo.UseSuspenseQueryResult<AlliancesQuery, AlliancesQueryVariables>;
export function useAlliancesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AlliancesQuery, AlliancesQueryVariables>): Apollo.UseSuspenseQueryResult<AlliancesQuery | undefined, AlliancesQueryVariables>;
export function useAlliancesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AlliancesQuery, AlliancesQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<AlliancesQuery, AlliancesQueryVariables>(AlliancesDocument, options);
        }
export type AlliancesQueryHookResult = ReturnType<typeof useAlliancesQuery>;
export type AlliancesLazyQueryHookResult = ReturnType<typeof useAlliancesLazyQuery>;
export type AlliancesSuspenseQueryHookResult = ReturnType<typeof useAlliancesSuspenseQuery>;
export type AlliancesQueryResult = Apollo.QueryResult<AlliancesQuery, AlliancesQueryVariables>;
export const ActiveUsersUpdatesDocument = gql`
    subscription ActiveUsersUpdates {
  activeUsersUpdates {
    count
    timestamp
  }
}
    `;

/**
 * __useActiveUsersUpdatesSubscription__
 *
 * To run a query within a React component, call `useActiveUsersUpdatesSubscription` and pass it any options that fit your needs.
 * When your component renders, `useActiveUsersUpdatesSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useActiveUsersUpdatesSubscription({
 *   variables: {
 *   },
 * });
 */
export function useActiveUsersUpdatesSubscription(baseOptions?: Apollo.SubscriptionHookOptions<ActiveUsersUpdatesSubscription, ActiveUsersUpdatesSubscriptionVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useSubscription<ActiveUsersUpdatesSubscription, ActiveUsersUpdatesSubscriptionVariables>(ActiveUsersUpdatesDocument, options);
      }
export type ActiveUsersUpdatesSubscriptionHookResult = ReturnType<typeof useActiveUsersUpdatesSubscription>;
export type ActiveUsersUpdatesSubscriptionResult = Apollo.SubscriptionResult<ActiveUsersUpdatesSubscription>;
export const ActiveUsersCountDocument = gql`
    query ActiveUsersCount {
  activeUsersCount
}
    `;

/**
 * __useActiveUsersCountQuery__
 *
 * To run a query within a React component, call `useActiveUsersCountQuery` and pass it any options that fit your needs.
 * When your component renders, `useActiveUsersCountQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useActiveUsersCountQuery({
 *   variables: {
 *   },
 * });
 */
export function useActiveUsersCountQuery(baseOptions?: Apollo.QueryHookOptions<ActiveUsersCountQuery, ActiveUsersCountQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ActiveUsersCountQuery, ActiveUsersCountQueryVariables>(ActiveUsersCountDocument, options);
      }
export function useActiveUsersCountLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ActiveUsersCountQuery, ActiveUsersCountQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ActiveUsersCountQuery, ActiveUsersCountQueryVariables>(ActiveUsersCountDocument, options);
        }
// @ts-ignore
export function useActiveUsersCountSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<ActiveUsersCountQuery, ActiveUsersCountQueryVariables>): Apollo.UseSuspenseQueryResult<ActiveUsersCountQuery, ActiveUsersCountQueryVariables>;
export function useActiveUsersCountSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ActiveUsersCountQuery, ActiveUsersCountQueryVariables>): Apollo.UseSuspenseQueryResult<ActiveUsersCountQuery | undefined, ActiveUsersCountQueryVariables>;
export function useActiveUsersCountSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ActiveUsersCountQuery, ActiveUsersCountQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ActiveUsersCountQuery, ActiveUsersCountQueryVariables>(ActiveUsersCountDocument, options);
        }
export type ActiveUsersCountQueryHookResult = ReturnType<typeof useActiveUsersCountQuery>;
export type ActiveUsersCountLazyQueryHookResult = ReturnType<typeof useActiveUsersCountLazyQuery>;
export type ActiveUsersCountSuspenseQueryHookResult = ReturnType<typeof useActiveUsersCountSuspenseQuery>;
export type ActiveUsersCountQueryResult = Apollo.QueryResult<ActiveUsersCountQuery, ActiveUsersCountQueryVariables>;
export const RefreshTokenDocument = gql`
    mutation RefreshToken($refreshToken: String!) {
  refreshToken(refreshToken: $refreshToken) {
    accessToken
    refreshToken
    expiresIn
    user {
      id
      name
      email
      createdAt
    }
  }
}
    `;
export type RefreshTokenMutationFn = Apollo.MutationFunction<RefreshTokenMutation, RefreshTokenMutationVariables>;

/**
 * __useRefreshTokenMutation__
 *
 * To run a mutation, you first call `useRefreshTokenMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRefreshTokenMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [refreshTokenMutation, { data, loading, error }] = useRefreshTokenMutation({
 *   variables: {
 *      refreshToken: // value for 'refreshToken'
 *   },
 * });
 */
export function useRefreshTokenMutation(baseOptions?: Apollo.MutationHookOptions<RefreshTokenMutation, RefreshTokenMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RefreshTokenMutation, RefreshTokenMutationVariables>(RefreshTokenDocument, options);
      }
export type RefreshTokenMutationHookResult = ReturnType<typeof useRefreshTokenMutation>;
export type RefreshTokenMutationResult = Apollo.MutationResult<RefreshTokenMutation>;
export type RefreshTokenMutationOptions = Apollo.BaseMutationOptions<RefreshTokenMutation, RefreshTokenMutationVariables>;
export const CharacterDocument = gql`
    query Character($id: Int!) {
  character(id: $id) {
    id
    name
    birthday
    securityStatus
    description
    title
    updatedAt
    corporation {
      id
      name
      ticker
    }
    alliance {
      id
      name
      ticker
    }
  }
}
    `;

/**
 * __useCharacterQuery__
 *
 * To run a query within a React component, call `useCharacterQuery` and pass it any options that fit your needs.
 * When your component renders, `useCharacterQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCharacterQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useCharacterQuery(baseOptions: Apollo.QueryHookOptions<CharacterQuery, CharacterQueryVariables> & ({ variables: CharacterQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CharacterQuery, CharacterQueryVariables>(CharacterDocument, options);
      }
export function useCharacterLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CharacterQuery, CharacterQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CharacterQuery, CharacterQueryVariables>(CharacterDocument, options);
        }
// @ts-ignore
export function useCharacterSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CharacterQuery, CharacterQueryVariables>): Apollo.UseSuspenseQueryResult<CharacterQuery, CharacterQueryVariables>;
export function useCharacterSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CharacterQuery, CharacterQueryVariables>): Apollo.UseSuspenseQueryResult<CharacterQuery | undefined, CharacterQueryVariables>;
export function useCharacterSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CharacterQuery, CharacterQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CharacterQuery, CharacterQueryVariables>(CharacterDocument, options);
        }
export type CharacterQueryHookResult = ReturnType<typeof useCharacterQuery>;
export type CharacterLazyQueryHookResult = ReturnType<typeof useCharacterLazyQuery>;
export type CharacterSuspenseQueryHookResult = ReturnType<typeof useCharacterSuspenseQuery>;
export type CharacterQueryResult = Apollo.QueryResult<CharacterQuery, CharacterQueryVariables>;
export const CharacterKillmailsDocument = gql`
    query CharacterKillmails($filter: KillmailFilter) {
  killmails(filter: $filter) {
    items {
      id
      killmailTime
      totalValue
      attackerCount
      solo
      npc
      victim {
        character {
          id
          name
        }
        corporation {
          id
          name
        }
        alliance {
          id
          name
        }
        shipType {
          id
          name
          group {
            name
          }
          dogmaAttributes(ids: [422, 1692]) {
            attribute_id
            value
          }
        }
        damageTaken
      }
      finalBlow {
        character {
          id
          name
        }
        corporation {
          id
          name
        }
        alliance {
          id
          name
        }
      }
      solarSystem {
        id
        name
        securityStatus
        constellation {
          id
          name
          region {
            id
            name
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      currentPage
      totalPages
      totalCount
    }
  }
}
    `;

/**
 * __useCharacterKillmailsQuery__
 *
 * To run a query within a React component, call `useCharacterKillmailsQuery` and pass it any options that fit your needs.
 * When your component renders, `useCharacterKillmailsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCharacterKillmailsQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useCharacterKillmailsQuery(baseOptions?: Apollo.QueryHookOptions<CharacterKillmailsQuery, CharacterKillmailsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CharacterKillmailsQuery, CharacterKillmailsQueryVariables>(CharacterKillmailsDocument, options);
      }
export function useCharacterKillmailsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CharacterKillmailsQuery, CharacterKillmailsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CharacterKillmailsQuery, CharacterKillmailsQueryVariables>(CharacterKillmailsDocument, options);
        }
// @ts-ignore
export function useCharacterKillmailsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CharacterKillmailsQuery, CharacterKillmailsQueryVariables>): Apollo.UseSuspenseQueryResult<CharacterKillmailsQuery, CharacterKillmailsQueryVariables>;
export function useCharacterKillmailsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CharacterKillmailsQuery, CharacterKillmailsQueryVariables>): Apollo.UseSuspenseQueryResult<CharacterKillmailsQuery | undefined, CharacterKillmailsQueryVariables>;
export function useCharacterKillmailsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CharacterKillmailsQuery, CharacterKillmailsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CharacterKillmailsQuery, CharacterKillmailsQueryVariables>(CharacterKillmailsDocument, options);
        }
export type CharacterKillmailsQueryHookResult = ReturnType<typeof useCharacterKillmailsQuery>;
export type CharacterKillmailsLazyQueryHookResult = ReturnType<typeof useCharacterKillmailsLazyQuery>;
export type CharacterKillmailsSuspenseQueryHookResult = ReturnType<typeof useCharacterKillmailsSuspenseQuery>;
export type CharacterKillmailsQueryResult = Apollo.QueryResult<CharacterKillmailsQuery, CharacterKillmailsQueryVariables>;
export const CharacterTopAllianceTargetsDocument = gql`
    query CharacterTopAllianceTargets($characterId: Int!, $filter: TopTargetFilter) {
  characterTopAllianceTargets(characterId: $characterId, filter: $filter) {
    killCount
    alliance {
      id
      name
      ticker
    }
  }
}
    `;

/**
 * __useCharacterTopAllianceTargetsQuery__
 *
 * To run a query within a React component, call `useCharacterTopAllianceTargetsQuery` and pass it any options that fit your needs.
 * When your component renders, `useCharacterTopAllianceTargetsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCharacterTopAllianceTargetsQuery({
 *   variables: {
 *      characterId: // value for 'characterId'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useCharacterTopAllianceTargetsQuery(baseOptions: Apollo.QueryHookOptions<CharacterTopAllianceTargetsQuery, CharacterTopAllianceTargetsQueryVariables> & ({ variables: CharacterTopAllianceTargetsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CharacterTopAllianceTargetsQuery, CharacterTopAllianceTargetsQueryVariables>(CharacterTopAllianceTargetsDocument, options);
      }
export function useCharacterTopAllianceTargetsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CharacterTopAllianceTargetsQuery, CharacterTopAllianceTargetsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CharacterTopAllianceTargetsQuery, CharacterTopAllianceTargetsQueryVariables>(CharacterTopAllianceTargetsDocument, options);
        }
// @ts-ignore
export function useCharacterTopAllianceTargetsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CharacterTopAllianceTargetsQuery, CharacterTopAllianceTargetsQueryVariables>): Apollo.UseSuspenseQueryResult<CharacterTopAllianceTargetsQuery, CharacterTopAllianceTargetsQueryVariables>;
export function useCharacterTopAllianceTargetsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CharacterTopAllianceTargetsQuery, CharacterTopAllianceTargetsQueryVariables>): Apollo.UseSuspenseQueryResult<CharacterTopAllianceTargetsQuery | undefined, CharacterTopAllianceTargetsQueryVariables>;
export function useCharacterTopAllianceTargetsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CharacterTopAllianceTargetsQuery, CharacterTopAllianceTargetsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CharacterTopAllianceTargetsQuery, CharacterTopAllianceTargetsQueryVariables>(CharacterTopAllianceTargetsDocument, options);
        }
export type CharacterTopAllianceTargetsQueryHookResult = ReturnType<typeof useCharacterTopAllianceTargetsQuery>;
export type CharacterTopAllianceTargetsLazyQueryHookResult = ReturnType<typeof useCharacterTopAllianceTargetsLazyQuery>;
export type CharacterTopAllianceTargetsSuspenseQueryHookResult = ReturnType<typeof useCharacterTopAllianceTargetsSuspenseQuery>;
export type CharacterTopAllianceTargetsQueryResult = Apollo.QueryResult<CharacterTopAllianceTargetsQuery, CharacterTopAllianceTargetsQueryVariables>;
export const CharacterTopCorporationTargetsDocument = gql`
    query CharacterTopCorporationTargets($characterId: Int!, $filter: TopTargetFilter) {
  characterTopCorporationTargets(characterId: $characterId, filter: $filter) {
    killCount
    corporation {
      id
      name
      ticker
    }
  }
}
    `;

/**
 * __useCharacterTopCorporationTargetsQuery__
 *
 * To run a query within a React component, call `useCharacterTopCorporationTargetsQuery` and pass it any options that fit your needs.
 * When your component renders, `useCharacterTopCorporationTargetsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCharacterTopCorporationTargetsQuery({
 *   variables: {
 *      characterId: // value for 'characterId'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useCharacterTopCorporationTargetsQuery(baseOptions: Apollo.QueryHookOptions<CharacterTopCorporationTargetsQuery, CharacterTopCorporationTargetsQueryVariables> & ({ variables: CharacterTopCorporationTargetsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CharacterTopCorporationTargetsQuery, CharacterTopCorporationTargetsQueryVariables>(CharacterTopCorporationTargetsDocument, options);
      }
export function useCharacterTopCorporationTargetsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CharacterTopCorporationTargetsQuery, CharacterTopCorporationTargetsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CharacterTopCorporationTargetsQuery, CharacterTopCorporationTargetsQueryVariables>(CharacterTopCorporationTargetsDocument, options);
        }
// @ts-ignore
export function useCharacterTopCorporationTargetsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CharacterTopCorporationTargetsQuery, CharacterTopCorporationTargetsQueryVariables>): Apollo.UseSuspenseQueryResult<CharacterTopCorporationTargetsQuery, CharacterTopCorporationTargetsQueryVariables>;
export function useCharacterTopCorporationTargetsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CharacterTopCorporationTargetsQuery, CharacterTopCorporationTargetsQueryVariables>): Apollo.UseSuspenseQueryResult<CharacterTopCorporationTargetsQuery | undefined, CharacterTopCorporationTargetsQueryVariables>;
export function useCharacterTopCorporationTargetsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CharacterTopCorporationTargetsQuery, CharacterTopCorporationTargetsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CharacterTopCorporationTargetsQuery, CharacterTopCorporationTargetsQueryVariables>(CharacterTopCorporationTargetsDocument, options);
        }
export type CharacterTopCorporationTargetsQueryHookResult = ReturnType<typeof useCharacterTopCorporationTargetsQuery>;
export type CharacterTopCorporationTargetsLazyQueryHookResult = ReturnType<typeof useCharacterTopCorporationTargetsLazyQuery>;
export type CharacterTopCorporationTargetsSuspenseQueryHookResult = ReturnType<typeof useCharacterTopCorporationTargetsSuspenseQuery>;
export type CharacterTopCorporationTargetsQueryResult = Apollo.QueryResult<CharacterTopCorporationTargetsQuery, CharacterTopCorporationTargetsQueryVariables>;
export const CharacterTopShipTargetsDocument = gql`
    query CharacterTopShipTargets($characterId: Int!, $filter: TopTargetFilter) {
  characterTopShipTargets(characterId: $characterId, filter: $filter) {
    killCount
    shipType {
      id
      name
      dogmaAttributes(ids: [422, 1692]) {
        attribute_id
        value
      }
    }
  }
}
    `;

/**
 * __useCharacterTopShipTargetsQuery__
 *
 * To run a query within a React component, call `useCharacterTopShipTargetsQuery` and pass it any options that fit your needs.
 * When your component renders, `useCharacterTopShipTargetsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCharacterTopShipTargetsQuery({
 *   variables: {
 *      characterId: // value for 'characterId'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useCharacterTopShipTargetsQuery(baseOptions: Apollo.QueryHookOptions<CharacterTopShipTargetsQuery, CharacterTopShipTargetsQueryVariables> & ({ variables: CharacterTopShipTargetsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CharacterTopShipTargetsQuery, CharacterTopShipTargetsQueryVariables>(CharacterTopShipTargetsDocument, options);
      }
export function useCharacterTopShipTargetsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CharacterTopShipTargetsQuery, CharacterTopShipTargetsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CharacterTopShipTargetsQuery, CharacterTopShipTargetsQueryVariables>(CharacterTopShipTargetsDocument, options);
        }
// @ts-ignore
export function useCharacterTopShipTargetsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CharacterTopShipTargetsQuery, CharacterTopShipTargetsQueryVariables>): Apollo.UseSuspenseQueryResult<CharacterTopShipTargetsQuery, CharacterTopShipTargetsQueryVariables>;
export function useCharacterTopShipTargetsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CharacterTopShipTargetsQuery, CharacterTopShipTargetsQueryVariables>): Apollo.UseSuspenseQueryResult<CharacterTopShipTargetsQuery | undefined, CharacterTopShipTargetsQueryVariables>;
export function useCharacterTopShipTargetsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CharacterTopShipTargetsQuery, CharacterTopShipTargetsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CharacterTopShipTargetsQuery, CharacterTopShipTargetsQueryVariables>(CharacterTopShipTargetsDocument, options);
        }
export type CharacterTopShipTargetsQueryHookResult = ReturnType<typeof useCharacterTopShipTargetsQuery>;
export type CharacterTopShipTargetsLazyQueryHookResult = ReturnType<typeof useCharacterTopShipTargetsLazyQuery>;
export type CharacterTopShipTargetsSuspenseQueryHookResult = ReturnType<typeof useCharacterTopShipTargetsSuspenseQuery>;
export type CharacterTopShipTargetsQueryResult = Apollo.QueryResult<CharacterTopShipTargetsQuery, CharacterTopShipTargetsQueryVariables>;
export const CharacterTopShipsDocument = gql`
    query CharacterTopShips($characterId: Int!, $filter: TopTargetFilter) {
  characterTopShips(characterId: $characterId, filter: $filter) {
    killCount
    shipType {
      id
      name
      dogmaAttributes(ids: [422, 1692]) {
        attribute_id
        value
      }
    }
  }
}
    `;

/**
 * __useCharacterTopShipsQuery__
 *
 * To run a query within a React component, call `useCharacterTopShipsQuery` and pass it any options that fit your needs.
 * When your component renders, `useCharacterTopShipsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCharacterTopShipsQuery({
 *   variables: {
 *      characterId: // value for 'characterId'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useCharacterTopShipsQuery(baseOptions: Apollo.QueryHookOptions<CharacterTopShipsQuery, CharacterTopShipsQueryVariables> & ({ variables: CharacterTopShipsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CharacterTopShipsQuery, CharacterTopShipsQueryVariables>(CharacterTopShipsDocument, options);
      }
export function useCharacterTopShipsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CharacterTopShipsQuery, CharacterTopShipsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CharacterTopShipsQuery, CharacterTopShipsQueryVariables>(CharacterTopShipsDocument, options);
        }
// @ts-ignore
export function useCharacterTopShipsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CharacterTopShipsQuery, CharacterTopShipsQueryVariables>): Apollo.UseSuspenseQueryResult<CharacterTopShipsQuery, CharacterTopShipsQueryVariables>;
export function useCharacterTopShipsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CharacterTopShipsQuery, CharacterTopShipsQueryVariables>): Apollo.UseSuspenseQueryResult<CharacterTopShipsQuery | undefined, CharacterTopShipsQueryVariables>;
export function useCharacterTopShipsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CharacterTopShipsQuery, CharacterTopShipsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CharacterTopShipsQuery, CharacterTopShipsQueryVariables>(CharacterTopShipsDocument, options);
        }
export type CharacterTopShipsQueryHookResult = ReturnType<typeof useCharacterTopShipsQuery>;
export type CharacterTopShipsLazyQueryHookResult = ReturnType<typeof useCharacterTopShipsLazyQuery>;
export type CharacterTopShipsSuspenseQueryHookResult = ReturnType<typeof useCharacterTopShipsSuspenseQuery>;
export type CharacterTopShipsQueryResult = Apollo.QueryResult<CharacterTopShipsQuery, CharacterTopShipsQueryVariables>;
export const CharactersDocument = gql`
    query Characters($filter: CharacterFilter) {
  characters(filter: $filter) {
    items {
      id
      name
      securityStatus
      corporation {
        id
        name
        ticker
      }
      alliance {
        id
        name
        ticker
      }
    }
    pageInfo {
      currentPage
      totalPages
      totalCount
      hasNextPage
      hasPreviousPage
    }
  }
}
    `;

/**
 * __useCharactersQuery__
 *
 * To run a query within a React component, call `useCharactersQuery` and pass it any options that fit your needs.
 * When your component renders, `useCharactersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCharactersQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useCharactersQuery(baseOptions?: Apollo.QueryHookOptions<CharactersQuery, CharactersQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CharactersQuery, CharactersQueryVariables>(CharactersDocument, options);
      }
export function useCharactersLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CharactersQuery, CharactersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CharactersQuery, CharactersQueryVariables>(CharactersDocument, options);
        }
// @ts-ignore
export function useCharactersSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CharactersQuery, CharactersQueryVariables>): Apollo.UseSuspenseQueryResult<CharactersQuery, CharactersQueryVariables>;
export function useCharactersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CharactersQuery, CharactersQueryVariables>): Apollo.UseSuspenseQueryResult<CharactersQuery | undefined, CharactersQueryVariables>;
export function useCharactersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CharactersQuery, CharactersQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CharactersQuery, CharactersQueryVariables>(CharactersDocument, options);
        }
export type CharactersQueryHookResult = ReturnType<typeof useCharactersQuery>;
export type CharactersLazyQueryHookResult = ReturnType<typeof useCharactersLazyQuery>;
export type CharactersSuspenseQueryHookResult = ReturnType<typeof useCharactersSuspenseQuery>;
export type CharactersQueryResult = Apollo.QueryResult<CharactersQuery, CharactersQueryVariables>;
export const ConstellationsDocument = gql`
    query Constellations($filter: ConstellationFilter) {
  constellations(filter: $filter) {
    items {
      id
      name
      solarSystemCount
      securityStats {
        highSec
        lowSec
        nullSec
        wormhole
        avgSecurity
      }
      region {
        id
        name
      }
    }
    pageInfo {
      currentPage
      totalPages
      totalCount
      hasNextPage
      hasPreviousPage
    }
  }
}
    `;

/**
 * __useConstellationsQuery__
 *
 * To run a query within a React component, call `useConstellationsQuery` and pass it any options that fit your needs.
 * When your component renders, `useConstellationsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useConstellationsQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useConstellationsQuery(baseOptions?: Apollo.QueryHookOptions<ConstellationsQuery, ConstellationsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ConstellationsQuery, ConstellationsQueryVariables>(ConstellationsDocument, options);
      }
export function useConstellationsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ConstellationsQuery, ConstellationsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ConstellationsQuery, ConstellationsQueryVariables>(ConstellationsDocument, options);
        }
// @ts-ignore
export function useConstellationsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<ConstellationsQuery, ConstellationsQueryVariables>): Apollo.UseSuspenseQueryResult<ConstellationsQuery, ConstellationsQueryVariables>;
export function useConstellationsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ConstellationsQuery, ConstellationsQueryVariables>): Apollo.UseSuspenseQueryResult<ConstellationsQuery | undefined, ConstellationsQueryVariables>;
export function useConstellationsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ConstellationsQuery, ConstellationsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ConstellationsQuery, ConstellationsQueryVariables>(ConstellationsDocument, options);
        }
export type ConstellationsQueryHookResult = ReturnType<typeof useConstellationsQuery>;
export type ConstellationsLazyQueryHookResult = ReturnType<typeof useConstellationsLazyQuery>;
export type ConstellationsSuspenseQueryHookResult = ReturnType<typeof useConstellationsSuspenseQuery>;
export type ConstellationsQueryResult = Apollo.QueryResult<ConstellationsQuery, ConstellationsQueryVariables>;
export const ConstellationDocument = gql`
    query Constellation($id: Int!) {
  constellation(id: $id) {
    id
    name
    solarSystemCount
    securityStats {
      highSec
      lowSec
      nullSec
      wormhole
      avgSecurity
    }
    position {
      x
      y
      z
    }
    region {
      id
      name
    }
    solarSystems {
      id
      name
      securityStatus
      security_class
    }
  }
}
    `;

/**
 * __useConstellationQuery__
 *
 * To run a query within a React component, call `useConstellationQuery` and pass it any options that fit your needs.
 * When your component renders, `useConstellationQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useConstellationQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useConstellationQuery(baseOptions: Apollo.QueryHookOptions<ConstellationQuery, ConstellationQueryVariables> & ({ variables: ConstellationQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ConstellationQuery, ConstellationQueryVariables>(ConstellationDocument, options);
      }
export function useConstellationLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ConstellationQuery, ConstellationQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ConstellationQuery, ConstellationQueryVariables>(ConstellationDocument, options);
        }
// @ts-ignore
export function useConstellationSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<ConstellationQuery, ConstellationQueryVariables>): Apollo.UseSuspenseQueryResult<ConstellationQuery, ConstellationQueryVariables>;
export function useConstellationSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ConstellationQuery, ConstellationQueryVariables>): Apollo.UseSuspenseQueryResult<ConstellationQuery | undefined, ConstellationQueryVariables>;
export function useConstellationSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ConstellationQuery, ConstellationQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ConstellationQuery, ConstellationQueryVariables>(ConstellationDocument, options);
        }
export type ConstellationQueryHookResult = ReturnType<typeof useConstellationQuery>;
export type ConstellationLazyQueryHookResult = ReturnType<typeof useConstellationLazyQuery>;
export type ConstellationSuspenseQueryHookResult = ReturnType<typeof useConstellationSuspenseQuery>;
export type ConstellationQueryResult = Apollo.QueryResult<ConstellationQuery, ConstellationQueryVariables>;
export const CorporationDocument = gql`
    query Corporation($id: Int!, $filter: TopTargetFilter) {
  corporation(id: $id) {
    id
    name
    ticker
    date_founded
    member_count
    tax_rate
    url
    alliance {
      id
      name
      ticker
    }
    ceo {
      id
      name
    }
    creator {
      id
      name
    }
    metrics {
      memberCountDelta7d
      memberCountGrowthRate7d
    }
    topShipTargets(filter: $filter) {
      killCount
      shipType {
        id
        name
      }
    }
    topAllianceTargets(filter: $filter) {
      killCount
      alliance {
        id
        name
        ticker
      }
    }
    topCorporationTargets(filter: $filter) {
      killCount
      corporation {
        id
        name
        ticker
      }
    }
  }
}
    `;

/**
 * __useCorporationQuery__
 *
 * To run a query within a React component, call `useCorporationQuery` and pass it any options that fit your needs.
 * When your component renders, `useCorporationQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCorporationQuery({
 *   variables: {
 *      id: // value for 'id'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useCorporationQuery(baseOptions: Apollo.QueryHookOptions<CorporationQuery, CorporationQueryVariables> & ({ variables: CorporationQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CorporationQuery, CorporationQueryVariables>(CorporationDocument, options);
      }
export function useCorporationLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CorporationQuery, CorporationQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CorporationQuery, CorporationQueryVariables>(CorporationDocument, options);
        }
// @ts-ignore
export function useCorporationSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CorporationQuery, CorporationQueryVariables>): Apollo.UseSuspenseQueryResult<CorporationQuery, CorporationQueryVariables>;
export function useCorporationSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CorporationQuery, CorporationQueryVariables>): Apollo.UseSuspenseQueryResult<CorporationQuery | undefined, CorporationQueryVariables>;
export function useCorporationSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CorporationQuery, CorporationQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CorporationQuery, CorporationQueryVariables>(CorporationDocument, options);
        }
export type CorporationQueryHookResult = ReturnType<typeof useCorporationQuery>;
export type CorporationLazyQueryHookResult = ReturnType<typeof useCorporationLazyQuery>;
export type CorporationSuspenseQueryHookResult = ReturnType<typeof useCorporationSuspenseQuery>;
export type CorporationQueryResult = Apollo.QueryResult<CorporationQuery, CorporationQueryVariables>;
export const CorporationGrowthDocument = gql`
    query CorporationGrowth($id: Int!, $days: Int) {
  corporation(id: $id) {
    id
    snapshots(days: $days) {
      date
      memberCount
    }
  }
}
    `;

/**
 * __useCorporationGrowthQuery__
 *
 * To run a query within a React component, call `useCorporationGrowthQuery` and pass it any options that fit your needs.
 * When your component renders, `useCorporationGrowthQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCorporationGrowthQuery({
 *   variables: {
 *      id: // value for 'id'
 *      days: // value for 'days'
 *   },
 * });
 */
export function useCorporationGrowthQuery(baseOptions: Apollo.QueryHookOptions<CorporationGrowthQuery, CorporationGrowthQueryVariables> & ({ variables: CorporationGrowthQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CorporationGrowthQuery, CorporationGrowthQueryVariables>(CorporationGrowthDocument, options);
      }
export function useCorporationGrowthLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CorporationGrowthQuery, CorporationGrowthQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CorporationGrowthQuery, CorporationGrowthQueryVariables>(CorporationGrowthDocument, options);
        }
// @ts-ignore
export function useCorporationGrowthSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CorporationGrowthQuery, CorporationGrowthQueryVariables>): Apollo.UseSuspenseQueryResult<CorporationGrowthQuery, CorporationGrowthQueryVariables>;
export function useCorporationGrowthSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CorporationGrowthQuery, CorporationGrowthQueryVariables>): Apollo.UseSuspenseQueryResult<CorporationGrowthQuery | undefined, CorporationGrowthQueryVariables>;
export function useCorporationGrowthSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CorporationGrowthQuery, CorporationGrowthQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CorporationGrowthQuery, CorporationGrowthQueryVariables>(CorporationGrowthDocument, options);
        }
export type CorporationGrowthQueryHookResult = ReturnType<typeof useCorporationGrowthQuery>;
export type CorporationGrowthLazyQueryHookResult = ReturnType<typeof useCorporationGrowthLazyQuery>;
export type CorporationGrowthSuspenseQueryHookResult = ReturnType<typeof useCorporationGrowthSuspenseQuery>;
export type CorporationGrowthQueryResult = Apollo.QueryResult<CorporationGrowthQuery, CorporationGrowthQueryVariables>;
export const CorporationCharactersDocument = gql`
    query CorporationCharacters($filter: CharacterFilter) {
  characters(filter: $filter) {
    items {
      id
      name
      securityStatus
    }
    pageInfo {
      currentPage
      totalPages
      totalCount
      hasNextPage
      hasPreviousPage
    }
  }
}
    `;

/**
 * __useCorporationCharactersQuery__
 *
 * To run a query within a React component, call `useCorporationCharactersQuery` and pass it any options that fit your needs.
 * When your component renders, `useCorporationCharactersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCorporationCharactersQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useCorporationCharactersQuery(baseOptions?: Apollo.QueryHookOptions<CorporationCharactersQuery, CorporationCharactersQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CorporationCharactersQuery, CorporationCharactersQueryVariables>(CorporationCharactersDocument, options);
      }
export function useCorporationCharactersLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CorporationCharactersQuery, CorporationCharactersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CorporationCharactersQuery, CorporationCharactersQueryVariables>(CorporationCharactersDocument, options);
        }
// @ts-ignore
export function useCorporationCharactersSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CorporationCharactersQuery, CorporationCharactersQueryVariables>): Apollo.UseSuspenseQueryResult<CorporationCharactersQuery, CorporationCharactersQueryVariables>;
export function useCorporationCharactersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CorporationCharactersQuery, CorporationCharactersQueryVariables>): Apollo.UseSuspenseQueryResult<CorporationCharactersQuery | undefined, CorporationCharactersQueryVariables>;
export function useCorporationCharactersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CorporationCharactersQuery, CorporationCharactersQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CorporationCharactersQuery, CorporationCharactersQueryVariables>(CorporationCharactersDocument, options);
        }
export type CorporationCharactersQueryHookResult = ReturnType<typeof useCorporationCharactersQuery>;
export type CorporationCharactersLazyQueryHookResult = ReturnType<typeof useCorporationCharactersLazyQuery>;
export type CorporationCharactersSuspenseQueryHookResult = ReturnType<typeof useCorporationCharactersSuspenseQuery>;
export type CorporationCharactersQueryResult = Apollo.QueryResult<CorporationCharactersQuery, CorporationCharactersQueryVariables>;
export const CorporationKillmailsDocument = gql`
    query CorporationKillmails($filter: KillmailFilter) {
  killmails(filter: $filter) {
    items {
      id
      killmailTime
      totalValue
      attackerCount
      solo
      npc
      victim {
        character {
          id
          name
        }
        corporation {
          id
          name
        }
        alliance {
          id
          name
        }
        shipType {
          id
          name
          group {
            name
          }
          dogmaAttributes(ids: [422, 1692]) {
            attribute_id
            value
          }
        }
        damageTaken
      }
      finalBlow {
        character {
          id
          name
        }
        corporation {
          id
          name
        }
        alliance {
          id
          name
        }
      }
      solarSystem {
        id
        name
        securityStatus
        constellation {
          id
          name
          region {
            id
            name
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      currentPage
      totalPages
      totalCount
    }
  }
}
    `;

/**
 * __useCorporationKillmailsQuery__
 *
 * To run a query within a React component, call `useCorporationKillmailsQuery` and pass it any options that fit your needs.
 * When your component renders, `useCorporationKillmailsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCorporationKillmailsQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useCorporationKillmailsQuery(baseOptions?: Apollo.QueryHookOptions<CorporationKillmailsQuery, CorporationKillmailsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CorporationKillmailsQuery, CorporationKillmailsQueryVariables>(CorporationKillmailsDocument, options);
      }
export function useCorporationKillmailsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CorporationKillmailsQuery, CorporationKillmailsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CorporationKillmailsQuery, CorporationKillmailsQueryVariables>(CorporationKillmailsDocument, options);
        }
// @ts-ignore
export function useCorporationKillmailsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CorporationKillmailsQuery, CorporationKillmailsQueryVariables>): Apollo.UseSuspenseQueryResult<CorporationKillmailsQuery, CorporationKillmailsQueryVariables>;
export function useCorporationKillmailsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CorporationKillmailsQuery, CorporationKillmailsQueryVariables>): Apollo.UseSuspenseQueryResult<CorporationKillmailsQuery | undefined, CorporationKillmailsQueryVariables>;
export function useCorporationKillmailsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CorporationKillmailsQuery, CorporationKillmailsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CorporationKillmailsQuery, CorporationKillmailsQueryVariables>(CorporationKillmailsDocument, options);
        }
export type CorporationKillmailsQueryHookResult = ReturnType<typeof useCorporationKillmailsQuery>;
export type CorporationKillmailsLazyQueryHookResult = ReturnType<typeof useCorporationKillmailsLazyQuery>;
export type CorporationKillmailsSuspenseQueryHookResult = ReturnType<typeof useCorporationKillmailsSuspenseQuery>;
export type CorporationKillmailsQueryResult = Apollo.QueryResult<CorporationKillmailsQuery, CorporationKillmailsQueryVariables>;
export const CorporationTopAllianceTargetsDocument = gql`
    query CorporationTopAllianceTargets($corporationId: Int!, $filter: TopTargetFilter) {
  corporationTopAllianceTargets(corporationId: $corporationId, filter: $filter) {
    killCount
    alliance {
      id
      name
      ticker
    }
  }
}
    `;

/**
 * __useCorporationTopAllianceTargetsQuery__
 *
 * To run a query within a React component, call `useCorporationTopAllianceTargetsQuery` and pass it any options that fit your needs.
 * When your component renders, `useCorporationTopAllianceTargetsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCorporationTopAllianceTargetsQuery({
 *   variables: {
 *      corporationId: // value for 'corporationId'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useCorporationTopAllianceTargetsQuery(baseOptions: Apollo.QueryHookOptions<CorporationTopAllianceTargetsQuery, CorporationTopAllianceTargetsQueryVariables> & ({ variables: CorporationTopAllianceTargetsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CorporationTopAllianceTargetsQuery, CorporationTopAllianceTargetsQueryVariables>(CorporationTopAllianceTargetsDocument, options);
      }
export function useCorporationTopAllianceTargetsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CorporationTopAllianceTargetsQuery, CorporationTopAllianceTargetsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CorporationTopAllianceTargetsQuery, CorporationTopAllianceTargetsQueryVariables>(CorporationTopAllianceTargetsDocument, options);
        }
// @ts-ignore
export function useCorporationTopAllianceTargetsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CorporationTopAllianceTargetsQuery, CorporationTopAllianceTargetsQueryVariables>): Apollo.UseSuspenseQueryResult<CorporationTopAllianceTargetsQuery, CorporationTopAllianceTargetsQueryVariables>;
export function useCorporationTopAllianceTargetsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CorporationTopAllianceTargetsQuery, CorporationTopAllianceTargetsQueryVariables>): Apollo.UseSuspenseQueryResult<CorporationTopAllianceTargetsQuery | undefined, CorporationTopAllianceTargetsQueryVariables>;
export function useCorporationTopAllianceTargetsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CorporationTopAllianceTargetsQuery, CorporationTopAllianceTargetsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CorporationTopAllianceTargetsQuery, CorporationTopAllianceTargetsQueryVariables>(CorporationTopAllianceTargetsDocument, options);
        }
export type CorporationTopAllianceTargetsQueryHookResult = ReturnType<typeof useCorporationTopAllianceTargetsQuery>;
export type CorporationTopAllianceTargetsLazyQueryHookResult = ReturnType<typeof useCorporationTopAllianceTargetsLazyQuery>;
export type CorporationTopAllianceTargetsSuspenseQueryHookResult = ReturnType<typeof useCorporationTopAllianceTargetsSuspenseQuery>;
export type CorporationTopAllianceTargetsQueryResult = Apollo.QueryResult<CorporationTopAllianceTargetsQuery, CorporationTopAllianceTargetsQueryVariables>;
export const CorporationTopCorporationTargetsDocument = gql`
    query CorporationTopCorporationTargets($corporationId: Int!, $filter: TopTargetFilter) {
  corporationTopCorporationTargets(corporationId: $corporationId, filter: $filter) {
    killCount
    corporation {
      id
      name
      ticker
    }
  }
}
    `;

/**
 * __useCorporationTopCorporationTargetsQuery__
 *
 * To run a query within a React component, call `useCorporationTopCorporationTargetsQuery` and pass it any options that fit your needs.
 * When your component renders, `useCorporationTopCorporationTargetsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCorporationTopCorporationTargetsQuery({
 *   variables: {
 *      corporationId: // value for 'corporationId'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useCorporationTopCorporationTargetsQuery(baseOptions: Apollo.QueryHookOptions<CorporationTopCorporationTargetsQuery, CorporationTopCorporationTargetsQueryVariables> & ({ variables: CorporationTopCorporationTargetsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CorporationTopCorporationTargetsQuery, CorporationTopCorporationTargetsQueryVariables>(CorporationTopCorporationTargetsDocument, options);
      }
export function useCorporationTopCorporationTargetsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CorporationTopCorporationTargetsQuery, CorporationTopCorporationTargetsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CorporationTopCorporationTargetsQuery, CorporationTopCorporationTargetsQueryVariables>(CorporationTopCorporationTargetsDocument, options);
        }
// @ts-ignore
export function useCorporationTopCorporationTargetsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CorporationTopCorporationTargetsQuery, CorporationTopCorporationTargetsQueryVariables>): Apollo.UseSuspenseQueryResult<CorporationTopCorporationTargetsQuery, CorporationTopCorporationTargetsQueryVariables>;
export function useCorporationTopCorporationTargetsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CorporationTopCorporationTargetsQuery, CorporationTopCorporationTargetsQueryVariables>): Apollo.UseSuspenseQueryResult<CorporationTopCorporationTargetsQuery | undefined, CorporationTopCorporationTargetsQueryVariables>;
export function useCorporationTopCorporationTargetsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CorporationTopCorporationTargetsQuery, CorporationTopCorporationTargetsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CorporationTopCorporationTargetsQuery, CorporationTopCorporationTargetsQueryVariables>(CorporationTopCorporationTargetsDocument, options);
        }
export type CorporationTopCorporationTargetsQueryHookResult = ReturnType<typeof useCorporationTopCorporationTargetsQuery>;
export type CorporationTopCorporationTargetsLazyQueryHookResult = ReturnType<typeof useCorporationTopCorporationTargetsLazyQuery>;
export type CorporationTopCorporationTargetsSuspenseQueryHookResult = ReturnType<typeof useCorporationTopCorporationTargetsSuspenseQuery>;
export type CorporationTopCorporationTargetsQueryResult = Apollo.QueryResult<CorporationTopCorporationTargetsQuery, CorporationTopCorporationTargetsQueryVariables>;
export const CorporationTopShipTargetsDocument = gql`
    query CorporationTopShipTargets($corporationId: Int!, $filter: TopTargetFilter) {
  corporationTopShipTargets(corporationId: $corporationId, filter: $filter) {
    killCount
    shipType {
      id
      name
      dogmaAttributes(ids: [422, 1692]) {
        attribute_id
        value
      }
    }
  }
}
    `;

/**
 * __useCorporationTopShipTargetsQuery__
 *
 * To run a query within a React component, call `useCorporationTopShipTargetsQuery` and pass it any options that fit your needs.
 * When your component renders, `useCorporationTopShipTargetsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCorporationTopShipTargetsQuery({
 *   variables: {
 *      corporationId: // value for 'corporationId'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useCorporationTopShipTargetsQuery(baseOptions: Apollo.QueryHookOptions<CorporationTopShipTargetsQuery, CorporationTopShipTargetsQueryVariables> & ({ variables: CorporationTopShipTargetsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CorporationTopShipTargetsQuery, CorporationTopShipTargetsQueryVariables>(CorporationTopShipTargetsDocument, options);
      }
export function useCorporationTopShipTargetsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CorporationTopShipTargetsQuery, CorporationTopShipTargetsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CorporationTopShipTargetsQuery, CorporationTopShipTargetsQueryVariables>(CorporationTopShipTargetsDocument, options);
        }
// @ts-ignore
export function useCorporationTopShipTargetsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CorporationTopShipTargetsQuery, CorporationTopShipTargetsQueryVariables>): Apollo.UseSuspenseQueryResult<CorporationTopShipTargetsQuery, CorporationTopShipTargetsQueryVariables>;
export function useCorporationTopShipTargetsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CorporationTopShipTargetsQuery, CorporationTopShipTargetsQueryVariables>): Apollo.UseSuspenseQueryResult<CorporationTopShipTargetsQuery | undefined, CorporationTopShipTargetsQueryVariables>;
export function useCorporationTopShipTargetsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CorporationTopShipTargetsQuery, CorporationTopShipTargetsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CorporationTopShipTargetsQuery, CorporationTopShipTargetsQueryVariables>(CorporationTopShipTargetsDocument, options);
        }
export type CorporationTopShipTargetsQueryHookResult = ReturnType<typeof useCorporationTopShipTargetsQuery>;
export type CorporationTopShipTargetsLazyQueryHookResult = ReturnType<typeof useCorporationTopShipTargetsLazyQuery>;
export type CorporationTopShipTargetsSuspenseQueryHookResult = ReturnType<typeof useCorporationTopShipTargetsSuspenseQuery>;
export type CorporationTopShipTargetsQueryResult = Apollo.QueryResult<CorporationTopShipTargetsQuery, CorporationTopShipTargetsQueryVariables>;
export const CorporationTopShipsDocument = gql`
    query CorporationTopShips($corporationId: Int!, $filter: TopTargetFilter) {
  corporationTopShips(corporationId: $corporationId, filter: $filter) {
    killCount
    shipType {
      id
      name
      dogmaAttributes(ids: [422, 1692]) {
        attribute_id
        value
      }
    }
  }
}
    `;

/**
 * __useCorporationTopShipsQuery__
 *
 * To run a query within a React component, call `useCorporationTopShipsQuery` and pass it any options that fit your needs.
 * When your component renders, `useCorporationTopShipsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCorporationTopShipsQuery({
 *   variables: {
 *      corporationId: // value for 'corporationId'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useCorporationTopShipsQuery(baseOptions: Apollo.QueryHookOptions<CorporationTopShipsQuery, CorporationTopShipsQueryVariables> & ({ variables: CorporationTopShipsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CorporationTopShipsQuery, CorporationTopShipsQueryVariables>(CorporationTopShipsDocument, options);
      }
export function useCorporationTopShipsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CorporationTopShipsQuery, CorporationTopShipsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CorporationTopShipsQuery, CorporationTopShipsQueryVariables>(CorporationTopShipsDocument, options);
        }
// @ts-ignore
export function useCorporationTopShipsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CorporationTopShipsQuery, CorporationTopShipsQueryVariables>): Apollo.UseSuspenseQueryResult<CorporationTopShipsQuery, CorporationTopShipsQueryVariables>;
export function useCorporationTopShipsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CorporationTopShipsQuery, CorporationTopShipsQueryVariables>): Apollo.UseSuspenseQueryResult<CorporationTopShipsQuery | undefined, CorporationTopShipsQueryVariables>;
export function useCorporationTopShipsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CorporationTopShipsQuery, CorporationTopShipsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CorporationTopShipsQuery, CorporationTopShipsQueryVariables>(CorporationTopShipsDocument, options);
        }
export type CorporationTopShipsQueryHookResult = ReturnType<typeof useCorporationTopShipsQuery>;
export type CorporationTopShipsLazyQueryHookResult = ReturnType<typeof useCorporationTopShipsLazyQuery>;
export type CorporationTopShipsSuspenseQueryHookResult = ReturnType<typeof useCorporationTopShipsSuspenseQuery>;
export type CorporationTopShipsQueryResult = Apollo.QueryResult<CorporationTopShipsQuery, CorporationTopShipsQueryVariables>;
export const CorporationTopCharactersDocument = gql`
    query CorporationTopCharacters($corporationId: Int!, $filter: TopTargetFilter) {
  corporationTopCharacters(corporationId: $corporationId, filter: $filter) {
    killCount
    character {
      id
      name
      securityStatus
      corporation {
        id
        name
      }
      alliance {
        id
        name
      }
    }
  }
}
    `;

/**
 * __useCorporationTopCharactersQuery__
 *
 * To run a query within a React component, call `useCorporationTopCharactersQuery` and pass it any options that fit your needs.
 * When your component renders, `useCorporationTopCharactersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCorporationTopCharactersQuery({
 *   variables: {
 *      corporationId: // value for 'corporationId'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useCorporationTopCharactersQuery(baseOptions: Apollo.QueryHookOptions<CorporationTopCharactersQuery, CorporationTopCharactersQueryVariables> & ({ variables: CorporationTopCharactersQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CorporationTopCharactersQuery, CorporationTopCharactersQueryVariables>(CorporationTopCharactersDocument, options);
      }
export function useCorporationTopCharactersLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CorporationTopCharactersQuery, CorporationTopCharactersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CorporationTopCharactersQuery, CorporationTopCharactersQueryVariables>(CorporationTopCharactersDocument, options);
        }
// @ts-ignore
export function useCorporationTopCharactersSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CorporationTopCharactersQuery, CorporationTopCharactersQueryVariables>): Apollo.UseSuspenseQueryResult<CorporationTopCharactersQuery, CorporationTopCharactersQueryVariables>;
export function useCorporationTopCharactersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CorporationTopCharactersQuery, CorporationTopCharactersQueryVariables>): Apollo.UseSuspenseQueryResult<CorporationTopCharactersQuery | undefined, CorporationTopCharactersQueryVariables>;
export function useCorporationTopCharactersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CorporationTopCharactersQuery, CorporationTopCharactersQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CorporationTopCharactersQuery, CorporationTopCharactersQueryVariables>(CorporationTopCharactersDocument, options);
        }
export type CorporationTopCharactersQueryHookResult = ReturnType<typeof useCorporationTopCharactersQuery>;
export type CorporationTopCharactersLazyQueryHookResult = ReturnType<typeof useCorporationTopCharactersLazyQuery>;
export type CorporationTopCharactersSuspenseQueryHookResult = ReturnType<typeof useCorporationTopCharactersSuspenseQuery>;
export type CorporationTopCharactersQueryResult = Apollo.QueryResult<CorporationTopCharactersQuery, CorporationTopCharactersQueryVariables>;
export const CorporationsDocument = gql`
    query Corporations($filter: CorporationFilter) {
  corporations(filter: $filter) {
    items {
      id
      name
      ticker
      member_count
      date_founded
      alliance {
        id
        name
        ticker
      }
      metrics {
        memberCountDelta1d
        memberCountDelta7d
        memberCountDelta30d
        memberCountGrowthRate1d
        memberCountGrowthRate7d
        memberCountGrowthRate30d
      }
    }
    pageInfo {
      currentPage
      totalPages
      totalCount
      hasNextPage
      hasPreviousPage
    }
  }
}
    `;

/**
 * __useCorporationsQuery__
 *
 * To run a query within a React component, call `useCorporationsQuery` and pass it any options that fit your needs.
 * When your component renders, `useCorporationsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCorporationsQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useCorporationsQuery(baseOptions?: Apollo.QueryHookOptions<CorporationsQuery, CorporationsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CorporationsQuery, CorporationsQueryVariables>(CorporationsDocument, options);
      }
export function useCorporationsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CorporationsQuery, CorporationsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CorporationsQuery, CorporationsQueryVariables>(CorporationsDocument, options);
        }
// @ts-ignore
export function useCorporationsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CorporationsQuery, CorporationsQueryVariables>): Apollo.UseSuspenseQueryResult<CorporationsQuery, CorporationsQueryVariables>;
export function useCorporationsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CorporationsQuery, CorporationsQueryVariables>): Apollo.UseSuspenseQueryResult<CorporationsQuery | undefined, CorporationsQueryVariables>;
export function useCorporationsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CorporationsQuery, CorporationsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CorporationsQuery, CorporationsQueryVariables>(CorporationsDocument, options);
        }
export type CorporationsQueryHookResult = ReturnType<typeof useCorporationsQuery>;
export type CorporationsLazyQueryHookResult = ReturnType<typeof useCorporationsLazyQuery>;
export type CorporationsSuspenseQueryHookResult = ReturnType<typeof useCorporationsSuspenseQuery>;
export type CorporationsQueryResult = Apollo.QueryResult<CorporationsQuery, CorporationsQueryVariables>;
export const KillmailDocument = gql`
    query Killmail($id: ID!) {
  killmail(id: $id) {
    id
    killmailHash
    killmailTime
    destroyedValue
    droppedValue
    totalValue
    attackerCount
    solo
    npc
    solarSystem {
      id
      name
      securityStatus
      constellation {
        id
        name
        region {
          id
          name
        }
      }
    }
    victim {
      damageTaken
      character {
        id
        name
      }
      corporation {
        id
        name
        ticker
      }
      alliance {
        id
        name
        ticker
      }
      shipType {
        id
        name
        description
        dogmaAttributes(ids: [422, 1692]) {
          attribute_id
          value
        }
        jitaPrice {
          buy
          sell
          average
        }
        group {
          name
          category {
            name
          }
        }
      }
    }
    attackers {
      damageDone
      finalBlow
      securityStatus
      character {
        id
        name
      }
      corporation {
        id
        name
      }
      alliance {
        id
        name
      }
      shipType {
        id
        name
        dogmaAttributes(ids: [422, 1692]) {
          attribute_id
          value
        }
        group {
          name
        }
      }
      weaponType {
        id
        name
      }
    }
    fitting {
      highSlots {
        totalSlots
        slots {
          slotIndex
          module {
            flag
            singleton
            itemType {
              id
              name
              jitaPrice {
                buy
                sell
                average
              }
              group {
                name
              }
            }
            quantityDropped
            quantityDestroyed
            charge {
              singleton
              itemType {
                id
                name
                jitaPrice {
                  buy
                  sell
                  average
                }
                group {
                  name
                }
              }
              quantityDropped
              quantityDestroyed
            }
          }
        }
      }
      midSlots {
        totalSlots
        slots {
          slotIndex
          module {
            flag
            singleton
            itemType {
              id
              name
              jitaPrice {
                buy
                sell
                average
              }
              group {
                name
              }
            }
            quantityDropped
            quantityDestroyed
            charge {
              singleton
              itemType {
                id
                name
                jitaPrice {
                  buy
                  sell
                  average
                }
                group {
                  name
                }
              }
              quantityDropped
              quantityDestroyed
            }
          }
        }
      }
      lowSlots {
        totalSlots
        slots {
          slotIndex
          module {
            flag
            singleton
            itemType {
              id
              name
              jitaPrice {
                buy
                sell
                average
              }
              group {
                name
              }
            }
            quantityDropped
            quantityDestroyed
            charge {
              singleton
              itemType {
                id
                name
                jitaPrice {
                  buy
                  sell
                  average
                }
                group {
                  name
                }
              }
              quantityDropped
              quantityDestroyed
            }
          }
        }
      }
      rigs {
        totalSlots
        slots {
          slotIndex
          module {
            flag
            singleton
            itemType {
              id
              name
              jitaPrice {
                buy
                sell
                average
              }
              group {
                name
              }
            }
            quantityDropped
            quantityDestroyed
          }
        }
      }
      subsystems {
        totalSlots
        slots {
          slotIndex
          module {
            flag
            singleton
            itemType {
              id
              name
              jitaPrice {
                buy
                sell
                average
              }
              group {
                name
              }
            }
            quantityDropped
            quantityDestroyed
          }
        }
      }
      serviceSlots {
        totalSlots
        slots {
          slotIndex
          module {
            flag
            singleton
            itemType {
              id
              name
              jitaPrice {
                buy
                sell
                average
              }
              group {
                name
              }
            }
            quantityDropped
            quantityDestroyed
          }
        }
      }
      implants {
        totalSlots
        slots {
          slotIndex
          module {
            singleton
            itemType {
              id
              name
              jitaPrice {
                buy
                sell
                average
              }
              group {
                name
              }
            }
            quantityDropped
            quantityDestroyed
          }
        }
      }
      cargo {
        flag
        singleton
        itemType {
          id
          name
          jitaPrice {
            buy
            sell
            average
          }
          group {
            name
            category {
              name
            }
          }
        }
        quantityDropped
        quantityDestroyed
      }
      droneBay {
        flag
        singleton
        itemType {
          id
          name
          jitaPrice {
            buy
            sell
            average
          }
          group {
            name
            category {
              name
            }
          }
        }
        quantityDropped
        quantityDestroyed
      }
      fleetHangar {
        flag
        singleton
        itemType {
          id
          name
          jitaPrice {
            buy
            sell
            average
          }
          group {
            name
            category {
              name
            }
          }
        }
        quantityDropped
        quantityDestroyed
      }
      fighterBay {
        flag
        singleton
        itemType {
          id
          name
          jitaPrice {
            buy
            sell
            average
          }
          group {
            name
            category {
              name
            }
          }
        }
        quantityDropped
        quantityDestroyed
      }
      structureFuel {
        flag
        singleton
        itemType {
          id
          name
          jitaPrice {
            buy
            sell
            average
          }
          group {
            name
            category {
              name
            }
          }
        }
        quantityDropped
        quantityDestroyed
      }
      coreRoom {
        flag
        singleton
        itemType {
          id
          name
          jitaPrice {
            buy
            sell
            average
          }
          group {
            name
            category {
              name
            }
          }
        }
        quantityDropped
        quantityDestroyed
      }
    }
  }
}
    `;

/**
 * __useKillmailQuery__
 *
 * To run a query within a React component, call `useKillmailQuery` and pass it any options that fit your needs.
 * When your component renders, `useKillmailQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useKillmailQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useKillmailQuery(baseOptions: Apollo.QueryHookOptions<KillmailQuery, KillmailQueryVariables> & ({ variables: KillmailQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<KillmailQuery, KillmailQueryVariables>(KillmailDocument, options);
      }
export function useKillmailLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<KillmailQuery, KillmailQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<KillmailQuery, KillmailQueryVariables>(KillmailDocument, options);
        }
// @ts-ignore
export function useKillmailSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<KillmailQuery, KillmailQueryVariables>): Apollo.UseSuspenseQueryResult<KillmailQuery, KillmailQueryVariables>;
export function useKillmailSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<KillmailQuery, KillmailQueryVariables>): Apollo.UseSuspenseQueryResult<KillmailQuery | undefined, KillmailQueryVariables>;
export function useKillmailSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<KillmailQuery, KillmailQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<KillmailQuery, KillmailQueryVariables>(KillmailDocument, options);
        }
export type KillmailQueryHookResult = ReturnType<typeof useKillmailQuery>;
export type KillmailLazyQueryHookResult = ReturnType<typeof useKillmailLazyQuery>;
export type KillmailSuspenseQueryHookResult = ReturnType<typeof useKillmailSuspenseQuery>;
export type KillmailQueryResult = Apollo.QueryResult<KillmailQuery, KillmailQueryVariables>;
export const KillmailsDocument = gql`
    query Killmails($filter: KillmailFilter) {
  killmails(filter: $filter) {
    items {
      id
      killmailTime
      totalValue
      attackerCount
      solo
      npc
      solarSystem {
        id
        name
        securityStatus
        constellation {
          id
          name
          region {
            id
            name
          }
        }
      }
      victim {
        character {
          id
          name
        }
        corporation {
          id
          name
        }
        alliance {
          id
          name
        }
        shipType {
          id
          name
          group {
            name
          }
          dogmaAttributes(ids: [422, 1692]) {
            attribute_id
            value
          }
        }
        damageTaken
      }
      finalBlow {
        character {
          id
          name
        }
        corporation {
          id
          name
        }
        alliance {
          id
          name
        }
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      currentPage
      totalPages
      totalCount
    }
  }
}
    `;

/**
 * __useKillmailsQuery__
 *
 * To run a query within a React component, call `useKillmailsQuery` and pass it any options that fit your needs.
 * When your component renders, `useKillmailsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useKillmailsQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useKillmailsQuery(baseOptions?: Apollo.QueryHookOptions<KillmailsQuery, KillmailsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<KillmailsQuery, KillmailsQueryVariables>(KillmailsDocument, options);
      }
export function useKillmailsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<KillmailsQuery, KillmailsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<KillmailsQuery, KillmailsQueryVariables>(KillmailsDocument, options);
        }
// @ts-ignore
export function useKillmailsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<KillmailsQuery, KillmailsQueryVariables>): Apollo.UseSuspenseQueryResult<KillmailsQuery, KillmailsQueryVariables>;
export function useKillmailsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<KillmailsQuery, KillmailsQueryVariables>): Apollo.UseSuspenseQueryResult<KillmailsQuery | undefined, KillmailsQueryVariables>;
export function useKillmailsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<KillmailsQuery, KillmailsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<KillmailsQuery, KillmailsQueryVariables>(KillmailsDocument, options);
        }
export type KillmailsQueryHookResult = ReturnType<typeof useKillmailsQuery>;
export type KillmailsLazyQueryHookResult = ReturnType<typeof useKillmailsLazyQuery>;
export type KillmailsSuspenseQueryHookResult = ReturnType<typeof useKillmailsSuspenseQuery>;
export type KillmailsQueryResult = Apollo.QueryResult<KillmailsQuery, KillmailsQueryVariables>;
export const KillmailsDateCountsDocument = gql`
    query KillmailsDateCounts($filter: KillmailFilter) {
  killmailsDateCounts(filter: $filter) {
    date
    count
  }
}
    `;

/**
 * __useKillmailsDateCountsQuery__
 *
 * To run a query within a React component, call `useKillmailsDateCountsQuery` and pass it any options that fit your needs.
 * When your component renders, `useKillmailsDateCountsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useKillmailsDateCountsQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useKillmailsDateCountsQuery(baseOptions?: Apollo.QueryHookOptions<KillmailsDateCountsQuery, KillmailsDateCountsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<KillmailsDateCountsQuery, KillmailsDateCountsQueryVariables>(KillmailsDateCountsDocument, options);
      }
export function useKillmailsDateCountsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<KillmailsDateCountsQuery, KillmailsDateCountsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<KillmailsDateCountsQuery, KillmailsDateCountsQueryVariables>(KillmailsDateCountsDocument, options);
        }
// @ts-ignore
export function useKillmailsDateCountsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<KillmailsDateCountsQuery, KillmailsDateCountsQueryVariables>): Apollo.UseSuspenseQueryResult<KillmailsDateCountsQuery, KillmailsDateCountsQueryVariables>;
export function useKillmailsDateCountsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<KillmailsDateCountsQuery, KillmailsDateCountsQueryVariables>): Apollo.UseSuspenseQueryResult<KillmailsDateCountsQuery | undefined, KillmailsDateCountsQueryVariables>;
export function useKillmailsDateCountsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<KillmailsDateCountsQuery, KillmailsDateCountsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<KillmailsDateCountsQuery, KillmailsDateCountsQueryVariables>(KillmailsDateCountsDocument, options);
        }
export type KillmailsDateCountsQueryHookResult = ReturnType<typeof useKillmailsDateCountsQuery>;
export type KillmailsDateCountsLazyQueryHookResult = ReturnType<typeof useKillmailsDateCountsLazyQuery>;
export type KillmailsDateCountsSuspenseQueryHookResult = ReturnType<typeof useKillmailsDateCountsSuspenseQuery>;
export type KillmailsDateCountsQueryResult = Apollo.QueryResult<KillmailsDateCountsQuery, KillmailsDateCountsQueryVariables>;
export const NewKillmailDocument = gql`
    subscription NewKillmail {
  newKillmail {
    id
    killmailTime
    totalValue
    attackerCount
    solarSystem {
      id
      name
      securityStatus
      constellation {
        id
        name
        region {
          name
        }
      }
    }
    victim {
      character {
        id
        name
      }
      corporation {
        id
        name
      }
      alliance {
        id
        name
      }
      shipType {
        id
        name
        group {
          name
        }
        dogmaAttributes(ids: [422, 1692]) {
          attribute_id
          value
        }
      }
      damageTaken
    }
    finalBlow {
      character {
        id
        name
      }
      corporation {
        id
        name
      }
      alliance {
        id
        name
      }
    }
  }
}
    `;

/**
 * __useNewKillmailSubscription__
 *
 * To run a query within a React component, call `useNewKillmailSubscription` and pass it any options that fit your needs.
 * When your component renders, `useNewKillmailSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useNewKillmailSubscription({
 *   variables: {
 *   },
 * });
 */
export function useNewKillmailSubscription(baseOptions?: Apollo.SubscriptionHookOptions<NewKillmailSubscription, NewKillmailSubscriptionVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useSubscription<NewKillmailSubscription, NewKillmailSubscriptionVariables>(NewKillmailDocument, options);
      }
export type NewKillmailSubscriptionHookResult = ReturnType<typeof useNewKillmailSubscription>;
export type NewKillmailSubscriptionResult = Apollo.SubscriptionResult<NewKillmailSubscription>;
export const RegionsDocument = gql`
    query Regions($filter: RegionFilter) {
  regions(filter: $filter) {
    items {
      id
      name
      description
      constellationCount
      solarSystemCount
      securityStats {
        highSec
        lowSec
        nullSec
        wormhole
        avgSecurity
      }
    }
    pageInfo {
      currentPage
      totalPages
      totalCount
      hasNextPage
      hasPreviousPage
    }
  }
}
    `;

/**
 * __useRegionsQuery__
 *
 * To run a query within a React component, call `useRegionsQuery` and pass it any options that fit your needs.
 * When your component renders, `useRegionsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useRegionsQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useRegionsQuery(baseOptions?: Apollo.QueryHookOptions<RegionsQuery, RegionsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<RegionsQuery, RegionsQueryVariables>(RegionsDocument, options);
      }
export function useRegionsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<RegionsQuery, RegionsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<RegionsQuery, RegionsQueryVariables>(RegionsDocument, options);
        }
// @ts-ignore
export function useRegionsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<RegionsQuery, RegionsQueryVariables>): Apollo.UseSuspenseQueryResult<RegionsQuery, RegionsQueryVariables>;
export function useRegionsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<RegionsQuery, RegionsQueryVariables>): Apollo.UseSuspenseQueryResult<RegionsQuery | undefined, RegionsQueryVariables>;
export function useRegionsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<RegionsQuery, RegionsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<RegionsQuery, RegionsQueryVariables>(RegionsDocument, options);
        }
export type RegionsQueryHookResult = ReturnType<typeof useRegionsQuery>;
export type RegionsLazyQueryHookResult = ReturnType<typeof useRegionsLazyQuery>;
export type RegionsSuspenseQueryHookResult = ReturnType<typeof useRegionsSuspenseQuery>;
export type RegionsQueryResult = Apollo.QueryResult<RegionsQuery, RegionsQueryVariables>;
export const RegionDocument = gql`
    query Region($id: Int!) {
  region(id: $id) {
    id
    name
    description
    constellationCount
    solarSystemCount
    securityStats {
      highSec
      lowSec
      nullSec
      wormhole
      avgSecurity
    }
    constellations {
      id
      name
      solarSystemCount
      securityStats {
        highSec
        lowSec
        nullSec
        avgSecurity
      }
    }
  }
}
    `;

/**
 * __useRegionQuery__
 *
 * To run a query within a React component, call `useRegionQuery` and pass it any options that fit your needs.
 * When your component renders, `useRegionQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useRegionQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useRegionQuery(baseOptions: Apollo.QueryHookOptions<RegionQuery, RegionQueryVariables> & ({ variables: RegionQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<RegionQuery, RegionQueryVariables>(RegionDocument, options);
      }
export function useRegionLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<RegionQuery, RegionQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<RegionQuery, RegionQueryVariables>(RegionDocument, options);
        }
// @ts-ignore
export function useRegionSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<RegionQuery, RegionQueryVariables>): Apollo.UseSuspenseQueryResult<RegionQuery, RegionQueryVariables>;
export function useRegionSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<RegionQuery, RegionQueryVariables>): Apollo.UseSuspenseQueryResult<RegionQuery | undefined, RegionQueryVariables>;
export function useRegionSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<RegionQuery, RegionQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<RegionQuery, RegionQueryVariables>(RegionDocument, options);
        }
export type RegionQueryHookResult = ReturnType<typeof useRegionQuery>;
export type RegionLazyQueryHookResult = ReturnType<typeof useRegionLazyQuery>;
export type RegionSuspenseQueryHookResult = ReturnType<typeof useRegionSuspenseQuery>;
export type RegionQueryResult = Apollo.QueryResult<RegionQuery, RegionQueryVariables>;
export const SearchAlliancesDocument = gql`
    query SearchAlliances($search: String!, $limit: Int = 40) {
  alliances(filter: {search: $search, limit: $limit}) {
    items {
      id
      name
      ticker
      memberCount
      corporationCount
    }
  }
}
    `;

/**
 * __useSearchAlliancesQuery__
 *
 * To run a query within a React component, call `useSearchAlliancesQuery` and pass it any options that fit your needs.
 * When your component renders, `useSearchAlliancesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSearchAlliancesQuery({
 *   variables: {
 *      search: // value for 'search'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useSearchAlliancesQuery(baseOptions: Apollo.QueryHookOptions<SearchAlliancesQuery, SearchAlliancesQueryVariables> & ({ variables: SearchAlliancesQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SearchAlliancesQuery, SearchAlliancesQueryVariables>(SearchAlliancesDocument, options);
      }
export function useSearchAlliancesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SearchAlliancesQuery, SearchAlliancesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SearchAlliancesQuery, SearchAlliancesQueryVariables>(SearchAlliancesDocument, options);
        }
// @ts-ignore
export function useSearchAlliancesSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SearchAlliancesQuery, SearchAlliancesQueryVariables>): Apollo.UseSuspenseQueryResult<SearchAlliancesQuery, SearchAlliancesQueryVariables>;
export function useSearchAlliancesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchAlliancesQuery, SearchAlliancesQueryVariables>): Apollo.UseSuspenseQueryResult<SearchAlliancesQuery | undefined, SearchAlliancesQueryVariables>;
export function useSearchAlliancesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchAlliancesQuery, SearchAlliancesQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SearchAlliancesQuery, SearchAlliancesQueryVariables>(SearchAlliancesDocument, options);
        }
export type SearchAlliancesQueryHookResult = ReturnType<typeof useSearchAlliancesQuery>;
export type SearchAlliancesLazyQueryHookResult = ReturnType<typeof useSearchAlliancesLazyQuery>;
export type SearchAlliancesSuspenseQueryHookResult = ReturnType<typeof useSearchAlliancesSuspenseQuery>;
export type SearchAlliancesQueryResult = Apollo.QueryResult<SearchAlliancesQuery, SearchAlliancesQueryVariables>;
export const SearchCharacterDocument = gql`
    query SearchCharacter($id: Int!) {
  character(id: $id) {
    id
    name
    corporation {
      id
      name
      ticker
    }
    alliance {
      id
      name
      ticker
    }
  }
}
    `;

/**
 * __useSearchCharacterQuery__
 *
 * To run a query within a React component, call `useSearchCharacterQuery` and pass it any options that fit your needs.
 * When your component renders, `useSearchCharacterQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSearchCharacterQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useSearchCharacterQuery(baseOptions: Apollo.QueryHookOptions<SearchCharacterQuery, SearchCharacterQueryVariables> & ({ variables: SearchCharacterQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SearchCharacterQuery, SearchCharacterQueryVariables>(SearchCharacterDocument, options);
      }
export function useSearchCharacterLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SearchCharacterQuery, SearchCharacterQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SearchCharacterQuery, SearchCharacterQueryVariables>(SearchCharacterDocument, options);
        }
// @ts-ignore
export function useSearchCharacterSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SearchCharacterQuery, SearchCharacterQueryVariables>): Apollo.UseSuspenseQueryResult<SearchCharacterQuery, SearchCharacterQueryVariables>;
export function useSearchCharacterSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchCharacterQuery, SearchCharacterQueryVariables>): Apollo.UseSuspenseQueryResult<SearchCharacterQuery | undefined, SearchCharacterQueryVariables>;
export function useSearchCharacterSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchCharacterQuery, SearchCharacterQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SearchCharacterQuery, SearchCharacterQueryVariables>(SearchCharacterDocument, options);
        }
export type SearchCharacterQueryHookResult = ReturnType<typeof useSearchCharacterQuery>;
export type SearchCharacterLazyQueryHookResult = ReturnType<typeof useSearchCharacterLazyQuery>;
export type SearchCharacterSuspenseQueryHookResult = ReturnType<typeof useSearchCharacterSuspenseQuery>;
export type SearchCharacterQueryResult = Apollo.QueryResult<SearchCharacterQuery, SearchCharacterQueryVariables>;
export const SearchCharactersDocument = gql`
    query SearchCharacters($search: String!, $limit: Int = 40) {
  characters(filter: {search: $search, limit: $limit}) {
    items {
      id
      name
      corporation {
        id
        name
        ticker
      }
      alliance {
        id
        name
        ticker
      }
    }
  }
}
    `;

/**
 * __useSearchCharactersQuery__
 *
 * To run a query within a React component, call `useSearchCharactersQuery` and pass it any options that fit your needs.
 * When your component renders, `useSearchCharactersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSearchCharactersQuery({
 *   variables: {
 *      search: // value for 'search'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useSearchCharactersQuery(baseOptions: Apollo.QueryHookOptions<SearchCharactersQuery, SearchCharactersQueryVariables> & ({ variables: SearchCharactersQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SearchCharactersQuery, SearchCharactersQueryVariables>(SearchCharactersDocument, options);
      }
export function useSearchCharactersLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SearchCharactersQuery, SearchCharactersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SearchCharactersQuery, SearchCharactersQueryVariables>(SearchCharactersDocument, options);
        }
// @ts-ignore
export function useSearchCharactersSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SearchCharactersQuery, SearchCharactersQueryVariables>): Apollo.UseSuspenseQueryResult<SearchCharactersQuery, SearchCharactersQueryVariables>;
export function useSearchCharactersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchCharactersQuery, SearchCharactersQueryVariables>): Apollo.UseSuspenseQueryResult<SearchCharactersQuery | undefined, SearchCharactersQueryVariables>;
export function useSearchCharactersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchCharactersQuery, SearchCharactersQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SearchCharactersQuery, SearchCharactersQueryVariables>(SearchCharactersDocument, options);
        }
export type SearchCharactersQueryHookResult = ReturnType<typeof useSearchCharactersQuery>;
export type SearchCharactersLazyQueryHookResult = ReturnType<typeof useSearchCharactersLazyQuery>;
export type SearchCharactersSuspenseQueryHookResult = ReturnType<typeof useSearchCharactersSuspenseQuery>;
export type SearchCharactersQueryResult = Apollo.QueryResult<SearchCharactersQuery, SearchCharactersQueryVariables>;
export const SearchConstellationDocument = gql`
    query SearchConstellation($id: Int!) {
  constellation(id: $id) {
    id
    name
    region {
      id
      name
    }
  }
}
    `;

/**
 * __useSearchConstellationQuery__
 *
 * To run a query within a React component, call `useSearchConstellationQuery` and pass it any options that fit your needs.
 * When your component renders, `useSearchConstellationQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSearchConstellationQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useSearchConstellationQuery(baseOptions: Apollo.QueryHookOptions<SearchConstellationQuery, SearchConstellationQueryVariables> & ({ variables: SearchConstellationQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SearchConstellationQuery, SearchConstellationQueryVariables>(SearchConstellationDocument, options);
      }
export function useSearchConstellationLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SearchConstellationQuery, SearchConstellationQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SearchConstellationQuery, SearchConstellationQueryVariables>(SearchConstellationDocument, options);
        }
// @ts-ignore
export function useSearchConstellationSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SearchConstellationQuery, SearchConstellationQueryVariables>): Apollo.UseSuspenseQueryResult<SearchConstellationQuery, SearchConstellationQueryVariables>;
export function useSearchConstellationSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchConstellationQuery, SearchConstellationQueryVariables>): Apollo.UseSuspenseQueryResult<SearchConstellationQuery | undefined, SearchConstellationQueryVariables>;
export function useSearchConstellationSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchConstellationQuery, SearchConstellationQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SearchConstellationQuery, SearchConstellationQueryVariables>(SearchConstellationDocument, options);
        }
export type SearchConstellationQueryHookResult = ReturnType<typeof useSearchConstellationQuery>;
export type SearchConstellationLazyQueryHookResult = ReturnType<typeof useSearchConstellationLazyQuery>;
export type SearchConstellationSuspenseQueryHookResult = ReturnType<typeof useSearchConstellationSuspenseQuery>;
export type SearchConstellationQueryResult = Apollo.QueryResult<SearchConstellationQuery, SearchConstellationQueryVariables>;
export const SearchConstellationsDocument = gql`
    query SearchConstellations($search: String!, $limit: Int = 40) {
  constellations(filter: {search: $search, limit: $limit}) {
    items {
      id
      name
      solarSystemCount
      securityStats {
        highSec
        lowSec
        nullSec
        wormhole
        avgSecurity
      }
      region {
        id
        name
      }
    }
  }
}
    `;

/**
 * __useSearchConstellationsQuery__
 *
 * To run a query within a React component, call `useSearchConstellationsQuery` and pass it any options that fit your needs.
 * When your component renders, `useSearchConstellationsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSearchConstellationsQuery({
 *   variables: {
 *      search: // value for 'search'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useSearchConstellationsQuery(baseOptions: Apollo.QueryHookOptions<SearchConstellationsQuery, SearchConstellationsQueryVariables> & ({ variables: SearchConstellationsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SearchConstellationsQuery, SearchConstellationsQueryVariables>(SearchConstellationsDocument, options);
      }
export function useSearchConstellationsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SearchConstellationsQuery, SearchConstellationsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SearchConstellationsQuery, SearchConstellationsQueryVariables>(SearchConstellationsDocument, options);
        }
// @ts-ignore
export function useSearchConstellationsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SearchConstellationsQuery, SearchConstellationsQueryVariables>): Apollo.UseSuspenseQueryResult<SearchConstellationsQuery, SearchConstellationsQueryVariables>;
export function useSearchConstellationsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchConstellationsQuery, SearchConstellationsQueryVariables>): Apollo.UseSuspenseQueryResult<SearchConstellationsQuery | undefined, SearchConstellationsQueryVariables>;
export function useSearchConstellationsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchConstellationsQuery, SearchConstellationsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SearchConstellationsQuery, SearchConstellationsQueryVariables>(SearchConstellationsDocument, options);
        }
export type SearchConstellationsQueryHookResult = ReturnType<typeof useSearchConstellationsQuery>;
export type SearchConstellationsLazyQueryHookResult = ReturnType<typeof useSearchConstellationsLazyQuery>;
export type SearchConstellationsSuspenseQueryHookResult = ReturnType<typeof useSearchConstellationsSuspenseQuery>;
export type SearchConstellationsQueryResult = Apollo.QueryResult<SearchConstellationsQuery, SearchConstellationsQueryVariables>;
export const SearchCorporationsDocument = gql`
    query SearchCorporations($search: String!, $limit: Int = 40) {
  corporations(filter: {search: $search, limit: $limit}) {
    items {
      id
      name
      ticker
      member_count
      alliance {
        id
        name
        ticker
      }
    }
  }
}
    `;

/**
 * __useSearchCorporationsQuery__
 *
 * To run a query within a React component, call `useSearchCorporationsQuery` and pass it any options that fit your needs.
 * When your component renders, `useSearchCorporationsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSearchCorporationsQuery({
 *   variables: {
 *      search: // value for 'search'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useSearchCorporationsQuery(baseOptions: Apollo.QueryHookOptions<SearchCorporationsQuery, SearchCorporationsQueryVariables> & ({ variables: SearchCorporationsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SearchCorporationsQuery, SearchCorporationsQueryVariables>(SearchCorporationsDocument, options);
      }
export function useSearchCorporationsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SearchCorporationsQuery, SearchCorporationsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SearchCorporationsQuery, SearchCorporationsQueryVariables>(SearchCorporationsDocument, options);
        }
// @ts-ignore
export function useSearchCorporationsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SearchCorporationsQuery, SearchCorporationsQueryVariables>): Apollo.UseSuspenseQueryResult<SearchCorporationsQuery, SearchCorporationsQueryVariables>;
export function useSearchCorporationsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchCorporationsQuery, SearchCorporationsQueryVariables>): Apollo.UseSuspenseQueryResult<SearchCorporationsQuery | undefined, SearchCorporationsQueryVariables>;
export function useSearchCorporationsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchCorporationsQuery, SearchCorporationsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SearchCorporationsQuery, SearchCorporationsQueryVariables>(SearchCorporationsDocument, options);
        }
export type SearchCorporationsQueryHookResult = ReturnType<typeof useSearchCorporationsQuery>;
export type SearchCorporationsLazyQueryHookResult = ReturnType<typeof useSearchCorporationsLazyQuery>;
export type SearchCorporationsSuspenseQueryHookResult = ReturnType<typeof useSearchCorporationsSuspenseQuery>;
export type SearchCorporationsQueryResult = Apollo.QueryResult<SearchCorporationsQuery, SearchCorporationsQueryVariables>;
export const SearchItemGroupsDocument = gql`
    query SearchItemGroups($search: String!, $limit: Int = 20) {
  itemGroups(filter: {search: $search, limit: $limit, category_id: 6}) {
    items {
      id
      name
      category {
        id
        name
      }
    }
  }
}
    `;

/**
 * __useSearchItemGroupsQuery__
 *
 * To run a query within a React component, call `useSearchItemGroupsQuery` and pass it any options that fit your needs.
 * When your component renders, `useSearchItemGroupsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSearchItemGroupsQuery({
 *   variables: {
 *      search: // value for 'search'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useSearchItemGroupsQuery(baseOptions: Apollo.QueryHookOptions<SearchItemGroupsQuery, SearchItemGroupsQueryVariables> & ({ variables: SearchItemGroupsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SearchItemGroupsQuery, SearchItemGroupsQueryVariables>(SearchItemGroupsDocument, options);
      }
export function useSearchItemGroupsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SearchItemGroupsQuery, SearchItemGroupsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SearchItemGroupsQuery, SearchItemGroupsQueryVariables>(SearchItemGroupsDocument, options);
        }
// @ts-ignore
export function useSearchItemGroupsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SearchItemGroupsQuery, SearchItemGroupsQueryVariables>): Apollo.UseSuspenseQueryResult<SearchItemGroupsQuery, SearchItemGroupsQueryVariables>;
export function useSearchItemGroupsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchItemGroupsQuery, SearchItemGroupsQueryVariables>): Apollo.UseSuspenseQueryResult<SearchItemGroupsQuery | undefined, SearchItemGroupsQueryVariables>;
export function useSearchItemGroupsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchItemGroupsQuery, SearchItemGroupsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SearchItemGroupsQuery, SearchItemGroupsQueryVariables>(SearchItemGroupsDocument, options);
        }
export type SearchItemGroupsQueryHookResult = ReturnType<typeof useSearchItemGroupsQuery>;
export type SearchItemGroupsLazyQueryHookResult = ReturnType<typeof useSearchItemGroupsLazyQuery>;
export type SearchItemGroupsSuspenseQueryHookResult = ReturnType<typeof useSearchItemGroupsSuspenseQuery>;
export type SearchItemGroupsQueryResult = Apollo.QueryResult<SearchItemGroupsQuery, SearchItemGroupsQueryVariables>;
export const SearchItemGroupDocument = gql`
    query SearchItemGroup($id: Int!) {
  itemGroup(id: $id) {
    id
    name
    category {
      id
      name
    }
  }
}
    `;

/**
 * __useSearchItemGroupQuery__
 *
 * To run a query within a React component, call `useSearchItemGroupQuery` and pass it any options that fit your needs.
 * When your component renders, `useSearchItemGroupQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSearchItemGroupQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useSearchItemGroupQuery(baseOptions: Apollo.QueryHookOptions<SearchItemGroupQuery, SearchItemGroupQueryVariables> & ({ variables: SearchItemGroupQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SearchItemGroupQuery, SearchItemGroupQueryVariables>(SearchItemGroupDocument, options);
      }
export function useSearchItemGroupLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SearchItemGroupQuery, SearchItemGroupQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SearchItemGroupQuery, SearchItemGroupQueryVariables>(SearchItemGroupDocument, options);
        }
// @ts-ignore
export function useSearchItemGroupSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SearchItemGroupQuery, SearchItemGroupQueryVariables>): Apollo.UseSuspenseQueryResult<SearchItemGroupQuery, SearchItemGroupQueryVariables>;
export function useSearchItemGroupSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchItemGroupQuery, SearchItemGroupQueryVariables>): Apollo.UseSuspenseQueryResult<SearchItemGroupQuery | undefined, SearchItemGroupQueryVariables>;
export function useSearchItemGroupSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchItemGroupQuery, SearchItemGroupQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SearchItemGroupQuery, SearchItemGroupQueryVariables>(SearchItemGroupDocument, options);
        }
export type SearchItemGroupQueryHookResult = ReturnType<typeof useSearchItemGroupQuery>;
export type SearchItemGroupLazyQueryHookResult = ReturnType<typeof useSearchItemGroupLazyQuery>;
export type SearchItemGroupSuspenseQueryHookResult = ReturnType<typeof useSearchItemGroupSuspenseQuery>;
export type SearchItemGroupQueryResult = Apollo.QueryResult<SearchItemGroupQuery, SearchItemGroupQueryVariables>;
export const SearchRegionDocument = gql`
    query SearchRegion($id: Int!) {
  region(id: $id) {
    id
    name
  }
}
    `;

/**
 * __useSearchRegionQuery__
 *
 * To run a query within a React component, call `useSearchRegionQuery` and pass it any options that fit your needs.
 * When your component renders, `useSearchRegionQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSearchRegionQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useSearchRegionQuery(baseOptions: Apollo.QueryHookOptions<SearchRegionQuery, SearchRegionQueryVariables> & ({ variables: SearchRegionQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SearchRegionQuery, SearchRegionQueryVariables>(SearchRegionDocument, options);
      }
export function useSearchRegionLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SearchRegionQuery, SearchRegionQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SearchRegionQuery, SearchRegionQueryVariables>(SearchRegionDocument, options);
        }
// @ts-ignore
export function useSearchRegionSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SearchRegionQuery, SearchRegionQueryVariables>): Apollo.UseSuspenseQueryResult<SearchRegionQuery, SearchRegionQueryVariables>;
export function useSearchRegionSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchRegionQuery, SearchRegionQueryVariables>): Apollo.UseSuspenseQueryResult<SearchRegionQuery | undefined, SearchRegionQueryVariables>;
export function useSearchRegionSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchRegionQuery, SearchRegionQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SearchRegionQuery, SearchRegionQueryVariables>(SearchRegionDocument, options);
        }
export type SearchRegionQueryHookResult = ReturnType<typeof useSearchRegionQuery>;
export type SearchRegionLazyQueryHookResult = ReturnType<typeof useSearchRegionLazyQuery>;
export type SearchRegionSuspenseQueryHookResult = ReturnType<typeof useSearchRegionSuspenseQuery>;
export type SearchRegionQueryResult = Apollo.QueryResult<SearchRegionQuery, SearchRegionQueryVariables>;
export const SearchRegionsDocument = gql`
    query SearchRegions($search: String!, $limit: Int = 40) {
  regions(filter: {search: $search, limit: $limit}) {
    items {
      id
      name
      solarSystemCount
      constellationCount
      securityStats {
        highSec
        lowSec
        nullSec
        wormhole
        avgSecurity
      }
    }
  }
}
    `;

/**
 * __useSearchRegionsQuery__
 *
 * To run a query within a React component, call `useSearchRegionsQuery` and pass it any options that fit your needs.
 * When your component renders, `useSearchRegionsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSearchRegionsQuery({
 *   variables: {
 *      search: // value for 'search'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useSearchRegionsQuery(baseOptions: Apollo.QueryHookOptions<SearchRegionsQuery, SearchRegionsQueryVariables> & ({ variables: SearchRegionsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SearchRegionsQuery, SearchRegionsQueryVariables>(SearchRegionsDocument, options);
      }
export function useSearchRegionsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SearchRegionsQuery, SearchRegionsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SearchRegionsQuery, SearchRegionsQueryVariables>(SearchRegionsDocument, options);
        }
// @ts-ignore
export function useSearchRegionsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SearchRegionsQuery, SearchRegionsQueryVariables>): Apollo.UseSuspenseQueryResult<SearchRegionsQuery, SearchRegionsQueryVariables>;
export function useSearchRegionsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchRegionsQuery, SearchRegionsQueryVariables>): Apollo.UseSuspenseQueryResult<SearchRegionsQuery | undefined, SearchRegionsQueryVariables>;
export function useSearchRegionsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchRegionsQuery, SearchRegionsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SearchRegionsQuery, SearchRegionsQueryVariables>(SearchRegionsDocument, options);
        }
export type SearchRegionsQueryHookResult = ReturnType<typeof useSearchRegionsQuery>;
export type SearchRegionsLazyQueryHookResult = ReturnType<typeof useSearchRegionsLazyQuery>;
export type SearchRegionsSuspenseQueryHookResult = ReturnType<typeof useSearchRegionsSuspenseQuery>;
export type SearchRegionsQueryResult = Apollo.QueryResult<SearchRegionsQuery, SearchRegionsQueryVariables>;
export const SearchSolarSystemDocument = gql`
    query SearchSolarSystem($id: Int!) {
  solarSystem(id: $id) {
    id
    name
    securityStatus
    constellation {
      id
      name
    }
  }
}
    `;

/**
 * __useSearchSolarSystemQuery__
 *
 * To run a query within a React component, call `useSearchSolarSystemQuery` and pass it any options that fit your needs.
 * When your component renders, `useSearchSolarSystemQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSearchSolarSystemQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useSearchSolarSystemQuery(baseOptions: Apollo.QueryHookOptions<SearchSolarSystemQuery, SearchSolarSystemQueryVariables> & ({ variables: SearchSolarSystemQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SearchSolarSystemQuery, SearchSolarSystemQueryVariables>(SearchSolarSystemDocument, options);
      }
export function useSearchSolarSystemLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SearchSolarSystemQuery, SearchSolarSystemQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SearchSolarSystemQuery, SearchSolarSystemQueryVariables>(SearchSolarSystemDocument, options);
        }
// @ts-ignore
export function useSearchSolarSystemSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SearchSolarSystemQuery, SearchSolarSystemQueryVariables>): Apollo.UseSuspenseQueryResult<SearchSolarSystemQuery, SearchSolarSystemQueryVariables>;
export function useSearchSolarSystemSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchSolarSystemQuery, SearchSolarSystemQueryVariables>): Apollo.UseSuspenseQueryResult<SearchSolarSystemQuery | undefined, SearchSolarSystemQueryVariables>;
export function useSearchSolarSystemSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchSolarSystemQuery, SearchSolarSystemQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SearchSolarSystemQuery, SearchSolarSystemQueryVariables>(SearchSolarSystemDocument, options);
        }
export type SearchSolarSystemQueryHookResult = ReturnType<typeof useSearchSolarSystemQuery>;
export type SearchSolarSystemLazyQueryHookResult = ReturnType<typeof useSearchSolarSystemLazyQuery>;
export type SearchSolarSystemSuspenseQueryHookResult = ReturnType<typeof useSearchSolarSystemSuspenseQuery>;
export type SearchSolarSystemQueryResult = Apollo.QueryResult<SearchSolarSystemQuery, SearchSolarSystemQueryVariables>;
export const SearchSolarSystemsDocument = gql`
    query SearchSolarSystems($search: String!, $limit: Int = 40) {
  solarSystems(filter: {search: $search, limit: $limit}) {
    items {
      id
      name
      securityStatus
      security_class
      constellation {
        id
        name
        region {
          id
          name
        }
      }
    }
  }
}
    `;

/**
 * __useSearchSolarSystemsQuery__
 *
 * To run a query within a React component, call `useSearchSolarSystemsQuery` and pass it any options that fit your needs.
 * When your component renders, `useSearchSolarSystemsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSearchSolarSystemsQuery({
 *   variables: {
 *      search: // value for 'search'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useSearchSolarSystemsQuery(baseOptions: Apollo.QueryHookOptions<SearchSolarSystemsQuery, SearchSolarSystemsQueryVariables> & ({ variables: SearchSolarSystemsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SearchSolarSystemsQuery, SearchSolarSystemsQueryVariables>(SearchSolarSystemsDocument, options);
      }
export function useSearchSolarSystemsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SearchSolarSystemsQuery, SearchSolarSystemsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SearchSolarSystemsQuery, SearchSolarSystemsQueryVariables>(SearchSolarSystemsDocument, options);
        }
// @ts-ignore
export function useSearchSolarSystemsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SearchSolarSystemsQuery, SearchSolarSystemsQueryVariables>): Apollo.UseSuspenseQueryResult<SearchSolarSystemsQuery, SearchSolarSystemsQueryVariables>;
export function useSearchSolarSystemsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchSolarSystemsQuery, SearchSolarSystemsQueryVariables>): Apollo.UseSuspenseQueryResult<SearchSolarSystemsQuery | undefined, SearchSolarSystemsQueryVariables>;
export function useSearchSolarSystemsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchSolarSystemsQuery, SearchSolarSystemsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SearchSolarSystemsQuery, SearchSolarSystemsQueryVariables>(SearchSolarSystemsDocument, options);
        }
export type SearchSolarSystemsQueryHookResult = ReturnType<typeof useSearchSolarSystemsQuery>;
export type SearchSolarSystemsLazyQueryHookResult = ReturnType<typeof useSearchSolarSystemsLazyQuery>;
export type SearchSolarSystemsSuspenseQueryHookResult = ReturnType<typeof useSearchSolarSystemsSuspenseQuery>;
export type SearchSolarSystemsQueryResult = Apollo.QueryResult<SearchSolarSystemsQuery, SearchSolarSystemsQueryVariables>;
export const SearchTypeDocument = gql`
    query SearchType($id: Int!) {
  type(id: $id) {
    id
    name
    group {
      id
      name
    }
  }
}
    `;

/**
 * __useSearchTypeQuery__
 *
 * To run a query within a React component, call `useSearchTypeQuery` and pass it any options that fit your needs.
 * When your component renders, `useSearchTypeQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSearchTypeQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useSearchTypeQuery(baseOptions: Apollo.QueryHookOptions<SearchTypeQuery, SearchTypeQueryVariables> & ({ variables: SearchTypeQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SearchTypeQuery, SearchTypeQueryVariables>(SearchTypeDocument, options);
      }
export function useSearchTypeLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SearchTypeQuery, SearchTypeQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SearchTypeQuery, SearchTypeQueryVariables>(SearchTypeDocument, options);
        }
// @ts-ignore
export function useSearchTypeSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SearchTypeQuery, SearchTypeQueryVariables>): Apollo.UseSuspenseQueryResult<SearchTypeQuery, SearchTypeQueryVariables>;
export function useSearchTypeSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchTypeQuery, SearchTypeQueryVariables>): Apollo.UseSuspenseQueryResult<SearchTypeQuery | undefined, SearchTypeQueryVariables>;
export function useSearchTypeSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchTypeQuery, SearchTypeQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SearchTypeQuery, SearchTypeQueryVariables>(SearchTypeDocument, options);
        }
export type SearchTypeQueryHookResult = ReturnType<typeof useSearchTypeQuery>;
export type SearchTypeLazyQueryHookResult = ReturnType<typeof useSearchTypeLazyQuery>;
export type SearchTypeSuspenseQueryHookResult = ReturnType<typeof useSearchTypeSuspenseQuery>;
export type SearchTypeQueryResult = Apollo.QueryResult<SearchTypeQuery, SearchTypeQueryVariables>;
export const SearchTypesDocument = gql`
    query SearchTypes($name: String!, $limit: Int = 40) {
  types(
    filter: {name: $name, limit: $limit, categoryList: [6, 22, 23, 40, 65], groupList: [1025]}
  ) {
    items {
      id
      name
      group {
        id
        name
      }
    }
  }
}
    `;

/**
 * __useSearchTypesQuery__
 *
 * To run a query within a React component, call `useSearchTypesQuery` and pass it any options that fit your needs.
 * When your component renders, `useSearchTypesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSearchTypesQuery({
 *   variables: {
 *      name: // value for 'name'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useSearchTypesQuery(baseOptions: Apollo.QueryHookOptions<SearchTypesQuery, SearchTypesQueryVariables> & ({ variables: SearchTypesQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SearchTypesQuery, SearchTypesQueryVariables>(SearchTypesDocument, options);
      }
export function useSearchTypesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SearchTypesQuery, SearchTypesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SearchTypesQuery, SearchTypesQueryVariables>(SearchTypesDocument, options);
        }
// @ts-ignore
export function useSearchTypesSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SearchTypesQuery, SearchTypesQueryVariables>): Apollo.UseSuspenseQueryResult<SearchTypesQuery, SearchTypesQueryVariables>;
export function useSearchTypesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchTypesQuery, SearchTypesQueryVariables>): Apollo.UseSuspenseQueryResult<SearchTypesQuery | undefined, SearchTypesQueryVariables>;
export function useSearchTypesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchTypesQuery, SearchTypesQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SearchTypesQuery, SearchTypesQueryVariables>(SearchTypesDocument, options);
        }
export type SearchTypesQueryHookResult = ReturnType<typeof useSearchTypesQuery>;
export type SearchTypesLazyQueryHookResult = ReturnType<typeof useSearchTypesLazyQuery>;
export type SearchTypesSuspenseQueryHookResult = ReturnType<typeof useSearchTypesSuspenseQuery>;
export type SearchTypesQueryResult = Apollo.QueryResult<SearchTypesQuery, SearchTypesQueryVariables>;
export const SolarSystemsDocument = gql`
    query SolarSystems($filter: SolarSystemFilter) {
  solarSystems(filter: $filter) {
    items {
      id
      name
      securityStatus
      constellation {
        id
        name
        region {
          id
          name
        }
      }
    }
    pageInfo {
      currentPage
      totalPages
      totalCount
      hasNextPage
      hasPreviousPage
    }
  }
}
    `;

/**
 * __useSolarSystemsQuery__
 *
 * To run a query within a React component, call `useSolarSystemsQuery` and pass it any options that fit your needs.
 * When your component renders, `useSolarSystemsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSolarSystemsQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useSolarSystemsQuery(baseOptions?: Apollo.QueryHookOptions<SolarSystemsQuery, SolarSystemsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SolarSystemsQuery, SolarSystemsQueryVariables>(SolarSystemsDocument, options);
      }
export function useSolarSystemsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SolarSystemsQuery, SolarSystemsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SolarSystemsQuery, SolarSystemsQueryVariables>(SolarSystemsDocument, options);
        }
// @ts-ignore
export function useSolarSystemsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SolarSystemsQuery, SolarSystemsQueryVariables>): Apollo.UseSuspenseQueryResult<SolarSystemsQuery, SolarSystemsQueryVariables>;
export function useSolarSystemsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SolarSystemsQuery, SolarSystemsQueryVariables>): Apollo.UseSuspenseQueryResult<SolarSystemsQuery | undefined, SolarSystemsQueryVariables>;
export function useSolarSystemsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SolarSystemsQuery, SolarSystemsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SolarSystemsQuery, SolarSystemsQueryVariables>(SolarSystemsDocument, options);
        }
export type SolarSystemsQueryHookResult = ReturnType<typeof useSolarSystemsQuery>;
export type SolarSystemsLazyQueryHookResult = ReturnType<typeof useSolarSystemsLazyQuery>;
export type SolarSystemsSuspenseQueryHookResult = ReturnType<typeof useSolarSystemsSuspenseQuery>;
export type SolarSystemsQueryResult = Apollo.QueryResult<SolarSystemsQuery, SolarSystemsQueryVariables>;
export const SolarSystemDocument = gql`
    query SolarSystem($id: Int!) {
  solarSystem(id: $id) {
    id
    name
    securityStatus
    security_class
    star_id
    position {
      x
      y
      z
    }
    constellation {
      id
      name
      region {
        id
        name
      }
    }
  }
}
    `;

/**
 * __useSolarSystemQuery__
 *
 * To run a query within a React component, call `useSolarSystemQuery` and pass it any options that fit your needs.
 * When your component renders, `useSolarSystemQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSolarSystemQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useSolarSystemQuery(baseOptions: Apollo.QueryHookOptions<SolarSystemQuery, SolarSystemQueryVariables> & ({ variables: SolarSystemQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SolarSystemQuery, SolarSystemQueryVariables>(SolarSystemDocument, options);
      }
export function useSolarSystemLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SolarSystemQuery, SolarSystemQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SolarSystemQuery, SolarSystemQueryVariables>(SolarSystemDocument, options);
        }
// @ts-ignore
export function useSolarSystemSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SolarSystemQuery, SolarSystemQueryVariables>): Apollo.UseSuspenseQueryResult<SolarSystemQuery, SolarSystemQueryVariables>;
export function useSolarSystemSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SolarSystemQuery, SolarSystemQueryVariables>): Apollo.UseSuspenseQueryResult<SolarSystemQuery | undefined, SolarSystemQueryVariables>;
export function useSolarSystemSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SolarSystemQuery, SolarSystemQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SolarSystemQuery, SolarSystemQueryVariables>(SolarSystemDocument, options);
        }
export type SolarSystemQueryHookResult = ReturnType<typeof useSolarSystemQuery>;
export type SolarSystemLazyQueryHookResult = ReturnType<typeof useSolarSystemLazyQuery>;
export type SolarSystemSuspenseQueryHookResult = ReturnType<typeof useSolarSystemSuspenseQuery>;
export type SolarSystemQueryResult = Apollo.QueryResult<SolarSystemQuery, SolarSystemQueryVariables>;
export const Top90DaysPilotsDocument = gql`
    query Top90DaysPilots($filter: Top90DaysPilotsFilter) {
  top90DaysPilots(filter: $filter) {
    rank
    killCount
    character {
      id
      name
      securityStatus
      corporation {
        id
        name
      }
      alliance {
        id
        name
      }
    }
  }
}
    `;

/**
 * __useTop90DaysPilotsQuery__
 *
 * To run a query within a React component, call `useTop90DaysPilotsQuery` and pass it any options that fit your needs.
 * When your component renders, `useTop90DaysPilotsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTop90DaysPilotsQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useTop90DaysPilotsQuery(baseOptions?: Apollo.QueryHookOptions<Top90DaysPilotsQuery, Top90DaysPilotsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<Top90DaysPilotsQuery, Top90DaysPilotsQueryVariables>(Top90DaysPilotsDocument, options);
      }
export function useTop90DaysPilotsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<Top90DaysPilotsQuery, Top90DaysPilotsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<Top90DaysPilotsQuery, Top90DaysPilotsQueryVariables>(Top90DaysPilotsDocument, options);
        }
// @ts-ignore
export function useTop90DaysPilotsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<Top90DaysPilotsQuery, Top90DaysPilotsQueryVariables>): Apollo.UseSuspenseQueryResult<Top90DaysPilotsQuery, Top90DaysPilotsQueryVariables>;
export function useTop90DaysPilotsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<Top90DaysPilotsQuery, Top90DaysPilotsQueryVariables>): Apollo.UseSuspenseQueryResult<Top90DaysPilotsQuery | undefined, Top90DaysPilotsQueryVariables>;
export function useTop90DaysPilotsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<Top90DaysPilotsQuery, Top90DaysPilotsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<Top90DaysPilotsQuery, Top90DaysPilotsQueryVariables>(Top90DaysPilotsDocument, options);
        }
export type Top90DaysPilotsQueryHookResult = ReturnType<typeof useTop90DaysPilotsQuery>;
export type Top90DaysPilotsLazyQueryHookResult = ReturnType<typeof useTop90DaysPilotsLazyQuery>;
export type Top90DaysPilotsSuspenseQueryHookResult = ReturnType<typeof useTop90DaysPilotsSuspenseQuery>;
export type Top90DaysPilotsQueryResult = Apollo.QueryResult<Top90DaysPilotsQuery, Top90DaysPilotsQueryVariables>;
export const TopLast7DaysAlliancesDocument = gql`
    query TopLast7DaysAlliances($filter: TopLast7DaysAlliancesFilter) {
  topLast7DaysAlliances(filter: $filter) {
    rank
    killCount
    alliance {
      id
      name
      ticker
    }
  }
}
    `;

/**
 * __useTopLast7DaysAlliancesQuery__
 *
 * To run a query within a React component, call `useTopLast7DaysAlliancesQuery` and pass it any options that fit your needs.
 * When your component renders, `useTopLast7DaysAlliancesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTopLast7DaysAlliancesQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useTopLast7DaysAlliancesQuery(baseOptions?: Apollo.QueryHookOptions<TopLast7DaysAlliancesQuery, TopLast7DaysAlliancesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<TopLast7DaysAlliancesQuery, TopLast7DaysAlliancesQueryVariables>(TopLast7DaysAlliancesDocument, options);
      }
export function useTopLast7DaysAlliancesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TopLast7DaysAlliancesQuery, TopLast7DaysAlliancesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<TopLast7DaysAlliancesQuery, TopLast7DaysAlliancesQueryVariables>(TopLast7DaysAlliancesDocument, options);
        }
// @ts-ignore
export function useTopLast7DaysAlliancesSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<TopLast7DaysAlliancesQuery, TopLast7DaysAlliancesQueryVariables>): Apollo.UseSuspenseQueryResult<TopLast7DaysAlliancesQuery, TopLast7DaysAlliancesQueryVariables>;
export function useTopLast7DaysAlliancesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TopLast7DaysAlliancesQuery, TopLast7DaysAlliancesQueryVariables>): Apollo.UseSuspenseQueryResult<TopLast7DaysAlliancesQuery | undefined, TopLast7DaysAlliancesQueryVariables>;
export function useTopLast7DaysAlliancesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TopLast7DaysAlliancesQuery, TopLast7DaysAlliancesQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<TopLast7DaysAlliancesQuery, TopLast7DaysAlliancesQueryVariables>(TopLast7DaysAlliancesDocument, options);
        }
export type TopLast7DaysAlliancesQueryHookResult = ReturnType<typeof useTopLast7DaysAlliancesQuery>;
export type TopLast7DaysAlliancesLazyQueryHookResult = ReturnType<typeof useTopLast7DaysAlliancesLazyQuery>;
export type TopLast7DaysAlliancesSuspenseQueryHookResult = ReturnType<typeof useTopLast7DaysAlliancesSuspenseQuery>;
export type TopLast7DaysAlliancesQueryResult = Apollo.QueryResult<TopLast7DaysAlliancesQuery, TopLast7DaysAlliancesQueryVariables>;
export const TopLast7DaysAttackerShipsDocument = gql`
    query TopLast7DaysAttackerShips($filter: TopLast7DaysAttackerShipsFilter) {
  topLast7DaysAttackerShips(filter: $filter) {
    rank
    killCount
    shipType {
      id
      name
      dogmaAttributes {
        attribute_id
        value
      }
    }
  }
}
    `;

/**
 * __useTopLast7DaysAttackerShipsQuery__
 *
 * To run a query within a React component, call `useTopLast7DaysAttackerShipsQuery` and pass it any options that fit your needs.
 * When your component renders, `useTopLast7DaysAttackerShipsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTopLast7DaysAttackerShipsQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useTopLast7DaysAttackerShipsQuery(baseOptions?: Apollo.QueryHookOptions<TopLast7DaysAttackerShipsQuery, TopLast7DaysAttackerShipsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<TopLast7DaysAttackerShipsQuery, TopLast7DaysAttackerShipsQueryVariables>(TopLast7DaysAttackerShipsDocument, options);
      }
export function useTopLast7DaysAttackerShipsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TopLast7DaysAttackerShipsQuery, TopLast7DaysAttackerShipsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<TopLast7DaysAttackerShipsQuery, TopLast7DaysAttackerShipsQueryVariables>(TopLast7DaysAttackerShipsDocument, options);
        }
// @ts-ignore
export function useTopLast7DaysAttackerShipsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<TopLast7DaysAttackerShipsQuery, TopLast7DaysAttackerShipsQueryVariables>): Apollo.UseSuspenseQueryResult<TopLast7DaysAttackerShipsQuery, TopLast7DaysAttackerShipsQueryVariables>;
export function useTopLast7DaysAttackerShipsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TopLast7DaysAttackerShipsQuery, TopLast7DaysAttackerShipsQueryVariables>): Apollo.UseSuspenseQueryResult<TopLast7DaysAttackerShipsQuery | undefined, TopLast7DaysAttackerShipsQueryVariables>;
export function useTopLast7DaysAttackerShipsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TopLast7DaysAttackerShipsQuery, TopLast7DaysAttackerShipsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<TopLast7DaysAttackerShipsQuery, TopLast7DaysAttackerShipsQueryVariables>(TopLast7DaysAttackerShipsDocument, options);
        }
export type TopLast7DaysAttackerShipsQueryHookResult = ReturnType<typeof useTopLast7DaysAttackerShipsQuery>;
export type TopLast7DaysAttackerShipsLazyQueryHookResult = ReturnType<typeof useTopLast7DaysAttackerShipsLazyQuery>;
export type TopLast7DaysAttackerShipsSuspenseQueryHookResult = ReturnType<typeof useTopLast7DaysAttackerShipsSuspenseQuery>;
export type TopLast7DaysAttackerShipsQueryResult = Apollo.QueryResult<TopLast7DaysAttackerShipsQuery, TopLast7DaysAttackerShipsQueryVariables>;
export const TopLast7DaysCorporationsDocument = gql`
    query TopLast7DaysCorporations($filter: TopLast7DaysCorporationsFilter) {
  topLast7DaysCorporations(filter: $filter) {
    rank
    killCount
    corporation {
      id
      name
      ticker
    }
  }
}
    `;

/**
 * __useTopLast7DaysCorporationsQuery__
 *
 * To run a query within a React component, call `useTopLast7DaysCorporationsQuery` and pass it any options that fit your needs.
 * When your component renders, `useTopLast7DaysCorporationsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTopLast7DaysCorporationsQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useTopLast7DaysCorporationsQuery(baseOptions?: Apollo.QueryHookOptions<TopLast7DaysCorporationsQuery, TopLast7DaysCorporationsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<TopLast7DaysCorporationsQuery, TopLast7DaysCorporationsQueryVariables>(TopLast7DaysCorporationsDocument, options);
      }
export function useTopLast7DaysCorporationsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TopLast7DaysCorporationsQuery, TopLast7DaysCorporationsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<TopLast7DaysCorporationsQuery, TopLast7DaysCorporationsQueryVariables>(TopLast7DaysCorporationsDocument, options);
        }
// @ts-ignore
export function useTopLast7DaysCorporationsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<TopLast7DaysCorporationsQuery, TopLast7DaysCorporationsQueryVariables>): Apollo.UseSuspenseQueryResult<TopLast7DaysCorporationsQuery, TopLast7DaysCorporationsQueryVariables>;
export function useTopLast7DaysCorporationsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TopLast7DaysCorporationsQuery, TopLast7DaysCorporationsQueryVariables>): Apollo.UseSuspenseQueryResult<TopLast7DaysCorporationsQuery | undefined, TopLast7DaysCorporationsQueryVariables>;
export function useTopLast7DaysCorporationsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TopLast7DaysCorporationsQuery, TopLast7DaysCorporationsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<TopLast7DaysCorporationsQuery, TopLast7DaysCorporationsQueryVariables>(TopLast7DaysCorporationsDocument, options);
        }
export type TopLast7DaysCorporationsQueryHookResult = ReturnType<typeof useTopLast7DaysCorporationsQuery>;
export type TopLast7DaysCorporationsLazyQueryHookResult = ReturnType<typeof useTopLast7DaysCorporationsLazyQuery>;
export type TopLast7DaysCorporationsSuspenseQueryHookResult = ReturnType<typeof useTopLast7DaysCorporationsSuspenseQuery>;
export type TopLast7DaysCorporationsQueryResult = Apollo.QueryResult<TopLast7DaysCorporationsQuery, TopLast7DaysCorporationsQueryVariables>;
export const TopLast7DaysPilotsDocument = gql`
    query TopLast7DaysPilots($filter: TopLast7DaysPilotsFilter) {
  topLast7DaysPilots(filter: $filter) {
    rank
    killCount
    character {
      id
      name
      securityStatus
      corporation {
        id
        name
      }
      alliance {
        id
        name
      }
    }
  }
}
    `;

/**
 * __useTopLast7DaysPilotsQuery__
 *
 * To run a query within a React component, call `useTopLast7DaysPilotsQuery` and pass it any options that fit your needs.
 * When your component renders, `useTopLast7DaysPilotsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTopLast7DaysPilotsQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useTopLast7DaysPilotsQuery(baseOptions?: Apollo.QueryHookOptions<TopLast7DaysPilotsQuery, TopLast7DaysPilotsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<TopLast7DaysPilotsQuery, TopLast7DaysPilotsQueryVariables>(TopLast7DaysPilotsDocument, options);
      }
export function useTopLast7DaysPilotsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TopLast7DaysPilotsQuery, TopLast7DaysPilotsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<TopLast7DaysPilotsQuery, TopLast7DaysPilotsQueryVariables>(TopLast7DaysPilotsDocument, options);
        }
// @ts-ignore
export function useTopLast7DaysPilotsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<TopLast7DaysPilotsQuery, TopLast7DaysPilotsQueryVariables>): Apollo.UseSuspenseQueryResult<TopLast7DaysPilotsQuery, TopLast7DaysPilotsQueryVariables>;
export function useTopLast7DaysPilotsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TopLast7DaysPilotsQuery, TopLast7DaysPilotsQueryVariables>): Apollo.UseSuspenseQueryResult<TopLast7DaysPilotsQuery | undefined, TopLast7DaysPilotsQueryVariables>;
export function useTopLast7DaysPilotsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TopLast7DaysPilotsQuery, TopLast7DaysPilotsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<TopLast7DaysPilotsQuery, TopLast7DaysPilotsQueryVariables>(TopLast7DaysPilotsDocument, options);
        }
export type TopLast7DaysPilotsQueryHookResult = ReturnType<typeof useTopLast7DaysPilotsQuery>;
export type TopLast7DaysPilotsLazyQueryHookResult = ReturnType<typeof useTopLast7DaysPilotsLazyQuery>;
export type TopLast7DaysPilotsSuspenseQueryHookResult = ReturnType<typeof useTopLast7DaysPilotsSuspenseQuery>;
export type TopLast7DaysPilotsQueryResult = Apollo.QueryResult<TopLast7DaysPilotsQuery, TopLast7DaysPilotsQueryVariables>;
export const TopLast7DaysShipsDocument = gql`
    query TopLast7DaysShips($filter: TopLast7DaysShipsFilter) {
  topLast7DaysShips(filter: $filter) {
    rank
    killCount
    shipType {
      id
      name
      dogmaAttributes {
        attribute_id
        value
      }
    }
  }
}
    `;

/**
 * __useTopLast7DaysShipsQuery__
 *
 * To run a query within a React component, call `useTopLast7DaysShipsQuery` and pass it any options that fit your needs.
 * When your component renders, `useTopLast7DaysShipsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTopLast7DaysShipsQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useTopLast7DaysShipsQuery(baseOptions?: Apollo.QueryHookOptions<TopLast7DaysShipsQuery, TopLast7DaysShipsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<TopLast7DaysShipsQuery, TopLast7DaysShipsQueryVariables>(TopLast7DaysShipsDocument, options);
      }
export function useTopLast7DaysShipsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TopLast7DaysShipsQuery, TopLast7DaysShipsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<TopLast7DaysShipsQuery, TopLast7DaysShipsQueryVariables>(TopLast7DaysShipsDocument, options);
        }
// @ts-ignore
export function useTopLast7DaysShipsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<TopLast7DaysShipsQuery, TopLast7DaysShipsQueryVariables>): Apollo.UseSuspenseQueryResult<TopLast7DaysShipsQuery, TopLast7DaysShipsQueryVariables>;
export function useTopLast7DaysShipsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TopLast7DaysShipsQuery, TopLast7DaysShipsQueryVariables>): Apollo.UseSuspenseQueryResult<TopLast7DaysShipsQuery | undefined, TopLast7DaysShipsQueryVariables>;
export function useTopLast7DaysShipsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TopLast7DaysShipsQuery, TopLast7DaysShipsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<TopLast7DaysShipsQuery, TopLast7DaysShipsQueryVariables>(TopLast7DaysShipsDocument, options);
        }
export type TopLast7DaysShipsQueryHookResult = ReturnType<typeof useTopLast7DaysShipsQuery>;
export type TopLast7DaysShipsLazyQueryHookResult = ReturnType<typeof useTopLast7DaysShipsLazyQuery>;
export type TopLast7DaysShipsSuspenseQueryHookResult = ReturnType<typeof useTopLast7DaysShipsSuspenseQuery>;
export type TopLast7DaysShipsQueryResult = Apollo.QueryResult<TopLast7DaysShipsQuery, TopLast7DaysShipsQueryVariables>;
export const TopMonthlyPilotsDocument = gql`
    query TopMonthlyPilots($filter: TopMonthlyPilotsFilter) {
  topMonthlyPilots(filter: $filter) {
    rank
    killCount
    character {
      id
      name
      securityStatus
      corporation {
        id
        name
      }
      alliance {
        id
        name
      }
    }
  }
}
    `;

/**
 * __useTopMonthlyPilotsQuery__
 *
 * To run a query within a React component, call `useTopMonthlyPilotsQuery` and pass it any options that fit your needs.
 * When your component renders, `useTopMonthlyPilotsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTopMonthlyPilotsQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useTopMonthlyPilotsQuery(baseOptions?: Apollo.QueryHookOptions<TopMonthlyPilotsQuery, TopMonthlyPilotsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<TopMonthlyPilotsQuery, TopMonthlyPilotsQueryVariables>(TopMonthlyPilotsDocument, options);
      }
export function useTopMonthlyPilotsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TopMonthlyPilotsQuery, TopMonthlyPilotsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<TopMonthlyPilotsQuery, TopMonthlyPilotsQueryVariables>(TopMonthlyPilotsDocument, options);
        }
// @ts-ignore
export function useTopMonthlyPilotsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<TopMonthlyPilotsQuery, TopMonthlyPilotsQueryVariables>): Apollo.UseSuspenseQueryResult<TopMonthlyPilotsQuery, TopMonthlyPilotsQueryVariables>;
export function useTopMonthlyPilotsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TopMonthlyPilotsQuery, TopMonthlyPilotsQueryVariables>): Apollo.UseSuspenseQueryResult<TopMonthlyPilotsQuery | undefined, TopMonthlyPilotsQueryVariables>;
export function useTopMonthlyPilotsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TopMonthlyPilotsQuery, TopMonthlyPilotsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<TopMonthlyPilotsQuery, TopMonthlyPilotsQueryVariables>(TopMonthlyPilotsDocument, options);
        }
export type TopMonthlyPilotsQueryHookResult = ReturnType<typeof useTopMonthlyPilotsQuery>;
export type TopMonthlyPilotsLazyQueryHookResult = ReturnType<typeof useTopMonthlyPilotsLazyQuery>;
export type TopMonthlyPilotsSuspenseQueryHookResult = ReturnType<typeof useTopMonthlyPilotsSuspenseQuery>;
export type TopMonthlyPilotsQueryResult = Apollo.QueryResult<TopMonthlyPilotsQuery, TopMonthlyPilotsQueryVariables>;
export const TopPilotsDocument = gql`
    query TopPilots($filter: TopPilotsFilter) {
  topPilots(filter: $filter) {
    rank
    killCount
    character {
      id
      name
      securityStatus
      corporation {
        id
        name
        ticker
      }
      alliance {
        id
        name
        ticker
      }
    }
  }
}
    `;

/**
 * __useTopPilotsQuery__
 *
 * To run a query within a React component, call `useTopPilotsQuery` and pass it any options that fit your needs.
 * When your component renders, `useTopPilotsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTopPilotsQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useTopPilotsQuery(baseOptions?: Apollo.QueryHookOptions<TopPilotsQuery, TopPilotsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<TopPilotsQuery, TopPilotsQueryVariables>(TopPilotsDocument, options);
      }
export function useTopPilotsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TopPilotsQuery, TopPilotsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<TopPilotsQuery, TopPilotsQueryVariables>(TopPilotsDocument, options);
        }
// @ts-ignore
export function useTopPilotsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<TopPilotsQuery, TopPilotsQueryVariables>): Apollo.UseSuspenseQueryResult<TopPilotsQuery, TopPilotsQueryVariables>;
export function useTopPilotsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TopPilotsQuery, TopPilotsQueryVariables>): Apollo.UseSuspenseQueryResult<TopPilotsQuery | undefined, TopPilotsQueryVariables>;
export function useTopPilotsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TopPilotsQuery, TopPilotsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<TopPilotsQuery, TopPilotsQueryVariables>(TopPilotsDocument, options);
        }
export type TopPilotsQueryHookResult = ReturnType<typeof useTopPilotsQuery>;
export type TopPilotsLazyQueryHookResult = ReturnType<typeof useTopPilotsLazyQuery>;
export type TopPilotsSuspenseQueryHookResult = ReturnType<typeof useTopPilotsSuspenseQuery>;
export type TopPilotsQueryResult = Apollo.QueryResult<TopPilotsQuery, TopPilotsQueryVariables>;
export const TopWeeklyPilotsDocument = gql`
    query TopWeeklyPilots($filter: TopWeeklyPilotsFilter) {
  topWeeklyPilots(filter: $filter) {
    rank
    killCount
    character {
      id
      name
      securityStatus
      corporation {
        id
        name
      }
      alliance {
        id
        name
      }
    }
  }
}
    `;

/**
 * __useTopWeeklyPilotsQuery__
 *
 * To run a query within a React component, call `useTopWeeklyPilotsQuery` and pass it any options that fit your needs.
 * When your component renders, `useTopWeeklyPilotsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTopWeeklyPilotsQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useTopWeeklyPilotsQuery(baseOptions?: Apollo.QueryHookOptions<TopWeeklyPilotsQuery, TopWeeklyPilotsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<TopWeeklyPilotsQuery, TopWeeklyPilotsQueryVariables>(TopWeeklyPilotsDocument, options);
      }
export function useTopWeeklyPilotsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TopWeeklyPilotsQuery, TopWeeklyPilotsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<TopWeeklyPilotsQuery, TopWeeklyPilotsQueryVariables>(TopWeeklyPilotsDocument, options);
        }
// @ts-ignore
export function useTopWeeklyPilotsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<TopWeeklyPilotsQuery, TopWeeklyPilotsQueryVariables>): Apollo.UseSuspenseQueryResult<TopWeeklyPilotsQuery, TopWeeklyPilotsQueryVariables>;
export function useTopWeeklyPilotsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TopWeeklyPilotsQuery, TopWeeklyPilotsQueryVariables>): Apollo.UseSuspenseQueryResult<TopWeeklyPilotsQuery | undefined, TopWeeklyPilotsQueryVariables>;
export function useTopWeeklyPilotsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TopWeeklyPilotsQuery, TopWeeklyPilotsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<TopWeeklyPilotsQuery, TopWeeklyPilotsQueryVariables>(TopWeeklyPilotsDocument, options);
        }
export type TopWeeklyPilotsQueryHookResult = ReturnType<typeof useTopWeeklyPilotsQuery>;
export type TopWeeklyPilotsLazyQueryHookResult = ReturnType<typeof useTopWeeklyPilotsLazyQuery>;
export type TopWeeklyPilotsSuspenseQueryHookResult = ReturnType<typeof useTopWeeklyPilotsSuspenseQuery>;
export type TopWeeklyPilotsQueryResult = Apollo.QueryResult<TopWeeklyPilotsQuery, TopWeeklyPilotsQueryVariables>;
export const WorkerStatusSubscriptionDocument = gql`
    subscription WorkerStatusSubscription {
  workerStatusUpdates {
    timestamp
    healthy
    databaseSizeMB
    redis {
      connected
      memoryUsage
      totalKeys
      connectedClients
      totalCommandsProcessed
      commandsPerSecond
      uptimeInSeconds
    }
    queues {
      name
      messageCount
      consumerCount
      active
      workerRunning
      workerPid
      workerName
    }
    standaloneWorkers {
      name
      running
      pid
      description
    }
  }
}
    `;

/**
 * __useWorkerStatusSubscriptionSubscription__
 *
 * To run a query within a React component, call `useWorkerStatusSubscriptionSubscription` and pass it any options that fit your needs.
 * When your component renders, `useWorkerStatusSubscriptionSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useWorkerStatusSubscriptionSubscription({
 *   variables: {
 *   },
 * });
 */
export function useWorkerStatusSubscriptionSubscription(baseOptions?: Apollo.SubscriptionHookOptions<WorkerStatusSubscriptionSubscription, WorkerStatusSubscriptionSubscriptionVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useSubscription<WorkerStatusSubscriptionSubscription, WorkerStatusSubscriptionSubscriptionVariables>(WorkerStatusSubscriptionDocument, options);
      }
export type WorkerStatusSubscriptionSubscriptionHookResult = ReturnType<typeof useWorkerStatusSubscriptionSubscription>;
export type WorkerStatusSubscriptionSubscriptionResult = Apollo.SubscriptionResult<WorkerStatusSubscriptionSubscription>;
export const WorkerStatusUpdatesDocument = gql`
    subscription WorkerStatusUpdates {
  workerStatusUpdates {
    timestamp
    healthy
    databaseSizeMB
    redis {
      memoryUsage
      totalKeys
      connectedClients
      uptimeInSeconds
    }
    queues {
      name
      messageCount
      consumerCount
      active
    }
  }
}
    `;

/**
 * __useWorkerStatusUpdatesSubscription__
 *
 * To run a query within a React component, call `useWorkerStatusUpdatesSubscription` and pass it any options that fit your needs.
 * When your component renders, `useWorkerStatusUpdatesSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useWorkerStatusUpdatesSubscription({
 *   variables: {
 *   },
 * });
 */
export function useWorkerStatusUpdatesSubscription(baseOptions?: Apollo.SubscriptionHookOptions<WorkerStatusUpdatesSubscription, WorkerStatusUpdatesSubscriptionVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useSubscription<WorkerStatusUpdatesSubscription, WorkerStatusUpdatesSubscriptionVariables>(WorkerStatusUpdatesDocument, options);
      }
export type WorkerStatusUpdatesSubscriptionHookResult = ReturnType<typeof useWorkerStatusUpdatesSubscription>;
export type WorkerStatusUpdatesSubscriptionResult = Apollo.SubscriptionResult<WorkerStatusUpdatesSubscription>;
export const WorkerStatusDocument = gql`
    query WorkerStatus {
  workerStatus {
    timestamp
    healthy
    queues {
      name
      messageCount
      consumerCount
      active
    }
  }
}
    `;

/**
 * __useWorkerStatusQuery__
 *
 * To run a query within a React component, call `useWorkerStatusQuery` and pass it any options that fit your needs.
 * When your component renders, `useWorkerStatusQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useWorkerStatusQuery({
 *   variables: {
 *   },
 * });
 */
export function useWorkerStatusQuery(baseOptions?: Apollo.QueryHookOptions<WorkerStatusQuery, WorkerStatusQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<WorkerStatusQuery, WorkerStatusQueryVariables>(WorkerStatusDocument, options);
      }
export function useWorkerStatusLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<WorkerStatusQuery, WorkerStatusQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<WorkerStatusQuery, WorkerStatusQueryVariables>(WorkerStatusDocument, options);
        }
// @ts-ignore
export function useWorkerStatusSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<WorkerStatusQuery, WorkerStatusQueryVariables>): Apollo.UseSuspenseQueryResult<WorkerStatusQuery, WorkerStatusQueryVariables>;
export function useWorkerStatusSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<WorkerStatusQuery, WorkerStatusQueryVariables>): Apollo.UseSuspenseQueryResult<WorkerStatusQuery | undefined, WorkerStatusQueryVariables>;
export function useWorkerStatusSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<WorkerStatusQuery, WorkerStatusQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<WorkerStatusQuery, WorkerStatusQueryVariables>(WorkerStatusDocument, options);
        }
export type WorkerStatusQueryHookResult = ReturnType<typeof useWorkerStatusQuery>;
export type WorkerStatusLazyQueryHookResult = ReturnType<typeof useWorkerStatusLazyQuery>;
export type WorkerStatusSuspenseQueryHookResult = ReturnType<typeof useWorkerStatusSuspenseQuery>;
export type WorkerStatusQueryResult = Apollo.QueryResult<WorkerStatusQuery, WorkerStatusQueryVariables>;