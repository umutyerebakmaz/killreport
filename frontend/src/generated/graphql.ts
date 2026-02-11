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
};


export type AllianceSnapshotsArgs = {
  days?: InputMaybe<Scalars['Int']['input']>;
};

export type AllianceConnection = {
  __typename?: 'AllianceConnection';
  edges: Array<AllianceEdge>;
  pageInfo: PageInfo;
};

export type AllianceEdge = {
  __typename?: 'AllianceEdge';
  cursor: Scalars['String']['output'];
  node: Alliance;
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

export type Category = {
  __typename?: 'Category';
  created_at: Scalars['String']['output'];
  groups: Array<ItemGroup>;
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  published: Scalars['Boolean']['output'];
  updated_at: Scalars['String']['output'];
};

export type CategoryConnection = {
  __typename?: 'CategoryConnection';
  edges: Array<CategoryEdge>;
  pageInfo: PageInfo;
};

export type CategoryEdge = {
  __typename?: 'CategoryEdge';
  cursor: Scalars['String']['output'];
  node: Category;
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
  security_status?: Maybe<Scalars['Float']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['String']['output']>;
};

export type CharacterConnection = {
  __typename?: 'CharacterConnection';
  edges: Array<CharacterEdge>;
  pageInfo: PageInfo;
};

export type CharacterEdge = {
  __typename?: 'CharacterEdge';
  cursor: Scalars['String']['output'];
  node: Character;
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

export type ConstellationConnection = {
  __typename?: 'ConstellationConnection';
  edges: Array<ConstellationEdge>;
  pageInfo: PageInfo;
};

export type ConstellationEdge = {
  __typename?: 'ConstellationEdge';
  cursor: Scalars['String']['output'];
  node: Constellation;
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
  url?: Maybe<Scalars['String']['output']>;
};


export type CorporationSnapshotsArgs = {
  days?: InputMaybe<Scalars['Int']['input']>;
};

export type CorporationConnection = {
  __typename?: 'CorporationConnection';
  edges: Array<CorporationEdge>;
  pageInfo: PageInfo;
};

export type CorporationEdge = {
  __typename?: 'CorporationEdge';
  cursor: Scalars['String']['output'];
  node: Corporation;
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

export type DogmaAttributeConnection = {
  __typename?: 'DogmaAttributeConnection';
  edges: Array<DogmaAttributeEdge>;
  pageInfo: PageInfo;
};

export type DogmaAttributeEdge = {
  __typename?: 'DogmaAttributeEdge';
  cursor: Scalars['String']['output'];
  node: DogmaAttribute;
};

export type DogmaAttributeFilter = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  published?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
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

export type DogmaEffectConnection = {
  __typename?: 'DogmaEffectConnection';
  edges: Array<DogmaEffectEdge>;
  pageInfo: PageInfo;
};

export type DogmaEffectEdge = {
  __typename?: 'DogmaEffectEdge';
  cursor: Scalars['String']['output'];
  node: DogmaEffect;
};

export type DogmaEffectFilter = {
  effect_category?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  published?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
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

export type ItemGroupConnection = {
  __typename?: 'ItemGroupConnection';
  edges: Array<ItemGroupEdge>;
  pageInfo: PageInfo;
};

export type ItemGroupEdge = {
  __typename?: 'ItemGroupEdge';
  cursor: Scalars['String']['output'];
  node: ItemGroup;
};

export type ItemGroupFilter = {
  category_id?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  published?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
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

export type KillmailConnection = {
  __typename?: 'KillmailConnection';
  edges: Array<KillmailEdge>;
  pageInfo: PageInfo;
};

export type KillmailDateCount = {
  __typename?: 'KillmailDateCount';
  count: Scalars['Int']['output'];
  date: Scalars['String']['output'];
};

export type KillmailEdge = {
  __typename?: 'KillmailEdge';
  cursor: Scalars['String']['output'];
  node: Killmail;
};

export type KillmailFilter = {
  allianceId?: InputMaybe<Scalars['Int']['input']>;
  characterId?: InputMaybe<Scalars['Int']['input']>;
  corporationId?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<KillmailOrderBy>;
  page?: InputMaybe<Scalars['Int']['input']>;
  regionId?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  shipTypeId?: InputMaybe<Scalars['Int']['input']>;
  systemId?: InputMaybe<Scalars['Int']['input']>;
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
  alliances: AllianceConnection;
  bloodline?: Maybe<Bloodline>;
  bloodlines: Array<Bloodline>;
  /** Cache statistics and memory usage */
  cacheStats: CacheStats;
  categories: CategoryConnection;
  category?: Maybe<Category>;
  character?: Maybe<Character>;
  characters: CharacterConnection;
  constellation?: Maybe<Constellation>;
  constellations: ConstellationConnection;
  corporation?: Maybe<Corporation>;
  corporations: CorporationConnection;
  dogmaAttribute?: Maybe<DogmaAttribute>;
  dogmaAttributes: DogmaAttributeConnection;
  dogmaEffect?: Maybe<DogmaEffect>;
  dogmaEffects: DogmaEffectConnection;
  itemGroup?: Maybe<ItemGroup>;
  itemGroups: ItemGroupConnection;
  /** Fetches a single killmail */
  killmail?: Maybe<Killmail>;
  /** Lists all killmails (with pagination using Relay-style connection) */
  killmails: KillmailConnection;
  /** Returns count of killmails grouped by date (for the current filter) */
  killmailsDateCounts: Array<KillmailDateCount>;
  /** Mevcut authenticated kullanıcının bilgilerini döner */
  me?: Maybe<User>;
  race?: Maybe<Race>;
  races: Array<Race>;
  region?: Maybe<Region>;
  regions: RegionConnection;
  solarSystem?: Maybe<SolarSystem>;
  solarSystems: SolarSystemConnection;
  type?: Maybe<Type>;
  types: TypeConnection;
  user?: Maybe<User>;
  users: Array<User>;
  /** Get current status of all workers and queues */
  workerStatus: WorkerStatus;
};


export type QueryAllianceArgs = {
  id: Scalars['Int']['input'];
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

export type RegionConnection = {
  __typename?: 'RegionConnection';
  edges: Array<RegionEdge>;
  pageInfo: PageInfo;
};

export type RegionEdge = {
  __typename?: 'RegionEdge';
  cursor: Scalars['String']['output'];
  node: Region;
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

export type SecurityStats = {
  __typename?: 'SecurityStats';
  avgSecurity?: Maybe<Scalars['Float']['output']>;
  highSec: Scalars['Int']['output'];
  lowSec: Scalars['Int']['output'];
  nullSec: Scalars['Int']['output'];
  wormhole: Scalars['Int']['output'];
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
  security_class?: Maybe<Scalars['String']['output']>;
  security_status?: Maybe<Scalars['Float']['output']>;
  star_id?: Maybe<Scalars['Int']['output']>;
};

export type SolarSystemConnection = {
  __typename?: 'SolarSystemConnection';
  edges: Array<SolarSystemEdge>;
  pageInfo: PageInfo;
};

export type SolarSystemEdge = {
  __typename?: 'SolarSystemEdge';
  cursor: Scalars['String']['output'];
  node: SolarSystem;
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

export type TypeConnection = {
  __typename?: 'TypeConnection';
  edges: Array<TypeEdge>;
  pageInfo: PageInfo;
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

export type TypeEdge = {
  __typename?: 'TypeEdge';
  cursor: Scalars['String']['output'];
  node: Type;
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

export type AllianceCorporationsQueryVariables = Exact<{
  filter?: InputMaybe<CorporationFilter>;
}>;


export type AllianceCorporationsQuery = { __typename?: 'Query', corporations: { __typename?: 'CorporationConnection', edges: Array<{ __typename?: 'CorporationEdge', node: { __typename?: 'Corporation', id: number, name: string, ticker: string, member_count: number, ceo?: { __typename?: 'Character', id: number, name: string } | null } }>, pageInfo: { __typename?: 'PageInfo', currentPage: number, totalPages: number, totalCount: number, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type AllianceKillmailsQueryVariables = Exact<{
  filter?: InputMaybe<KillmailFilter>;
}>;


export type AllianceKillmailsQuery = { __typename?: 'Query', killmails: { __typename?: 'KillmailConnection', edges: Array<{ __typename?: 'KillmailEdge', node: { __typename?: 'Killmail', id: string, killmailTime: string, totalValue?: number | null, attackerCount: number, solo: boolean, npc: boolean, victim?: { __typename?: 'Victim', damageTaken: number, character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null, shipType: { __typename?: 'Type', id: number, name: string, group?: { __typename?: 'ItemGroup', name: string } | null } } | null, finalBlow?: { __typename?: 'Attacker', character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null } | null, solarSystem: { __typename?: 'SolarSystem', id: number, name: string, security_status?: number | null, constellation?: { __typename?: 'Constellation', id: number, name: string, region?: { __typename?: 'Region', id: number, name: string } | null } | null } } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, currentPage: number, totalPages: number, totalCount: number } } };

export type AlliancesQueryVariables = Exact<{
  filter?: InputMaybe<AllianceFilter>;
}>;


export type AlliancesQuery = { __typename?: 'Query', alliances: { __typename?: 'AllianceConnection', edges: Array<{ __typename?: 'AllianceEdge', cursor: string, node: { __typename?: 'Alliance', id: number, name: string, ticker: string, date_founded: string, memberCount: number, corporationCount: number, metrics?: { __typename?: 'AllianceMetrics', memberCountDelta7d?: number | null, corporationCountDelta7d?: number | null, memberCountGrowthRate7d?: number | null } | null } }>, pageInfo: { __typename?: 'PageInfo', currentPage: number, totalPages: number, totalCount: number, hasNextPage: boolean, hasPreviousPage: boolean } } };

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


export type CharacterQuery = { __typename?: 'Query', character?: { __typename?: 'Character', id: number, name: string, birthday: string, security_status?: number | null, gender: string, description?: string | null, title?: string | null, updatedAt?: string | null, corporation?: { __typename?: 'Corporation', id: number, name: string, ticker: string, member_count: number } | null, alliance?: { __typename?: 'Alliance', id: number, name: string, ticker: string, memberCount: number } | null, race?: { __typename?: 'Race', id: number, name: string } | null, bloodline?: { __typename?: 'Bloodline', id: number, name: string } | null } | null };

export type CharacterKillmailsQueryVariables = Exact<{
  filter?: InputMaybe<KillmailFilter>;
}>;


export type CharacterKillmailsQuery = { __typename?: 'Query', killmails: { __typename?: 'KillmailConnection', edges: Array<{ __typename?: 'KillmailEdge', node: { __typename?: 'Killmail', id: string, killmailTime: string, totalValue?: number | null, attackerCount: number, solo: boolean, npc: boolean, victim?: { __typename?: 'Victim', damageTaken: number, character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null, shipType: { __typename?: 'Type', id: number, name: string, group?: { __typename?: 'ItemGroup', name: string } | null } } | null, finalBlow?: { __typename?: 'Attacker', character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null } | null, solarSystem: { __typename?: 'SolarSystem', id: number, name: string, security_status?: number | null, constellation?: { __typename?: 'Constellation', id: number, name: string, region?: { __typename?: 'Region', id: number, name: string } | null } | null } } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, currentPage: number, totalPages: number, totalCount: number } } };

export type CharactersQueryVariables = Exact<{
  filter?: InputMaybe<CharacterFilter>;
}>;


export type CharactersQuery = { __typename?: 'Query', characters: { __typename?: 'CharacterConnection', edges: Array<{ __typename?: 'CharacterEdge', cursor: string, node: { __typename?: 'Character', id: number, name: string, security_status?: number | null, corporation?: { __typename?: 'Corporation', id: number, name: string, ticker: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string, ticker: string } | null } }>, pageInfo: { __typename?: 'PageInfo', currentPage: number, totalPages: number, totalCount: number, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type ConstellationsQueryVariables = Exact<{
  filter?: InputMaybe<ConstellationFilter>;
}>;


export type ConstellationsQuery = { __typename?: 'Query', constellations: { __typename?: 'ConstellationConnection', edges: Array<{ __typename?: 'ConstellationEdge', cursor: string, node: { __typename?: 'Constellation', id: number, name: string, solarSystemCount: number, securityStats: { __typename?: 'SecurityStats', highSec: number, lowSec: number, nullSec: number, wormhole: number, avgSecurity?: number | null }, region?: { __typename?: 'Region', id: number, name: string } | null } }>, pageInfo: { __typename?: 'PageInfo', currentPage: number, totalPages: number, totalCount: number, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type ConstellationQueryVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type ConstellationQuery = { __typename?: 'Query', constellation?: { __typename?: 'Constellation', id: number, name: string, solarSystemCount: number, securityStats: { __typename?: 'SecurityStats', highSec: number, lowSec: number, nullSec: number, wormhole: number, avgSecurity?: number | null }, position?: { __typename?: 'Position', x: number, y: number, z: number } | null, region?: { __typename?: 'Region', id: number, name: string } | null, solarSystems: Array<{ __typename?: 'SolarSystem', id: number, name: string, security_status?: number | null, security_class?: string | null }> } | null };

export type CorporationQueryVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type CorporationQuery = { __typename?: 'Query', corporation?: { __typename?: 'Corporation', id: number, name: string, ticker: string, date_founded?: string | null, member_count: number, tax_rate: number, url?: string | null, alliance?: { __typename?: 'Alliance', id: number, name: string, ticker: string } | null, ceo?: { __typename?: 'Character', id: number, name: string } | null, creator?: { __typename?: 'Character', id: number, name: string } | null, metrics?: { __typename?: 'CorporationMetrics', memberCountDelta7d?: number | null, memberCountGrowthRate7d?: number | null } | null } | null };

export type CorporationCharactersQueryVariables = Exact<{
  filter?: InputMaybe<CharacterFilter>;
}>;


export type CorporationCharactersQuery = { __typename?: 'Query', characters: { __typename?: 'CharacterConnection', edges: Array<{ __typename?: 'CharacterEdge', node: { __typename?: 'Character', id: number, name: string, security_status?: number | null } }>, pageInfo: { __typename?: 'PageInfo', currentPage: number, totalPages: number, totalCount: number, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type CorporationKillmailsQueryVariables = Exact<{
  filter?: InputMaybe<KillmailFilter>;
}>;


export type CorporationKillmailsQuery = { __typename?: 'Query', killmails: { __typename?: 'KillmailConnection', edges: Array<{ __typename?: 'KillmailEdge', node: { __typename?: 'Killmail', id: string, killmailTime: string, totalValue?: number | null, attackerCount: number, solo: boolean, npc: boolean, victim?: { __typename?: 'Victim', damageTaken: number, character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null, shipType: { __typename?: 'Type', id: number, name: string, group?: { __typename?: 'ItemGroup', name: string } | null } } | null, finalBlow?: { __typename?: 'Attacker', character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null } | null, solarSystem: { __typename?: 'SolarSystem', id: number, name: string, security_status?: number | null, constellation?: { __typename?: 'Constellation', id: number, name: string, region?: { __typename?: 'Region', id: number, name: string } | null } | null } } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, currentPage: number, totalPages: number, totalCount: number } } };

export type CorporationsQueryVariables = Exact<{
  filter?: InputMaybe<CorporationFilter>;
}>;


export type CorporationsQuery = { __typename?: 'Query', corporations: { __typename?: 'CorporationConnection', edges: Array<{ __typename?: 'CorporationEdge', cursor: string, node: { __typename?: 'Corporation', id: number, name: string, ticker: string, member_count: number, date_founded?: string | null, alliance?: { __typename?: 'Alliance', id: number, name: string, ticker: string } | null, metrics?: { __typename?: 'CorporationMetrics', memberCountDelta1d?: number | null, memberCountDelta7d?: number | null, memberCountDelta30d?: number | null, memberCountGrowthRate1d?: number | null, memberCountGrowthRate7d?: number | null, memberCountGrowthRate30d?: number | null } | null } }>, pageInfo: { __typename?: 'PageInfo', currentPage: number, totalPages: number, totalCount: number, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type KillmailQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type KillmailQuery = { __typename?: 'Query', killmail?: { __typename?: 'Killmail', id: string, killmailHash: string, killmailTime: string, destroyedValue?: number | null, droppedValue?: number | null, totalValue?: number | null, attackerCount: number, solo: boolean, npc: boolean, solarSystem: { __typename?: 'SolarSystem', id: number, name: string, security_status?: number | null, constellation?: { __typename?: 'Constellation', id: number, name: string, region?: { __typename?: 'Region', id: number, name: string } | null } | null }, victim?: { __typename?: 'Victim', damageTaken: number, character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string, ticker: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string, ticker: string } | null, shipType: { __typename?: 'Type', id: number, name: string, description?: string | null, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string, category: { __typename?: 'Category', name: string } } | null } } | null, attackers: Array<{ __typename?: 'Attacker', damageDone: number, finalBlow: boolean, securityStatus?: number | null, character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null, shipType?: { __typename?: 'Type', id: number, name: string, group?: { __typename?: 'ItemGroup', name: string } | null } | null, weaponType?: { __typename?: 'Type', id: number, name: string } | null }>, fitting?: { __typename?: 'Fitting', highSlots: { __typename?: 'SlotGroup', totalSlots: number, slots: Array<{ __typename?: 'FittingSlot', slotIndex: number, module?: { __typename?: 'FittingModule', flag: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string } | null }, charge?: { __typename?: 'FittingModule', quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null } } | null } | null }> }, midSlots: { __typename?: 'SlotGroup', totalSlots: number, slots: Array<{ __typename?: 'FittingSlot', slotIndex: number, module?: { __typename?: 'FittingModule', flag: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string } | null }, charge?: { __typename?: 'FittingModule', quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null } } | null } | null }> }, lowSlots: { __typename?: 'SlotGroup', totalSlots: number, slots: Array<{ __typename?: 'FittingSlot', slotIndex: number, module?: { __typename?: 'FittingModule', flag: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string } | null }, charge?: { __typename?: 'FittingModule', quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null } } | null } | null }> }, rigs: { __typename?: 'SlotGroup', totalSlots: number, slots: Array<{ __typename?: 'FittingSlot', slotIndex: number, module?: { __typename?: 'FittingModule', flag: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string } | null } } | null }> }, subsystems: { __typename?: 'SlotGroup', totalSlots: number, slots: Array<{ __typename?: 'FittingSlot', slotIndex: number, module?: { __typename?: 'FittingModule', flag: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string } | null } } | null }> }, serviceSlots: { __typename?: 'SlotGroup', totalSlots: number, slots: Array<{ __typename?: 'FittingSlot', slotIndex: number, module?: { __typename?: 'FittingModule', flag: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null, group?: { __typename?: 'ItemGroup', name: string } | null } } | null }> }, implants: { __typename?: 'SlotGroup', totalSlots: number, slots: Array<{ __typename?: 'FittingSlot', slotIndex: number, module?: { __typename?: 'FittingModule', quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null } } | null }> }, cargo: Array<{ __typename?: 'FittingModule', flag: number, singleton: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null } }>, droneBay: Array<{ __typename?: 'FittingModule', flag: number, singleton: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null } }>, fighterBay: Array<{ __typename?: 'FittingModule', flag: number, singleton: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null } }>, structureFuel: Array<{ __typename?: 'FittingModule', flag: number, singleton: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null } }>, coreRoom: Array<{ __typename?: 'FittingModule', flag: number, singleton: number, quantityDropped?: number | null, quantityDestroyed?: number | null, itemType: { __typename?: 'Type', id: number, name: string, jitaPrice?: { __typename?: 'JitaPrice', buy: number, sell: number, average: number } | null } }> } | null } | null };

export type KillmailsQueryVariables = Exact<{
  filter?: InputMaybe<KillmailFilter>;
}>;


export type KillmailsQuery = { __typename?: 'Query', killmails: { __typename?: 'KillmailConnection', edges: Array<{ __typename?: 'KillmailEdge', node: { __typename?: 'Killmail', id: string, killmailTime: string, totalValue?: number | null, attackerCount: number, solo: boolean, npc: boolean, solarSystem: { __typename?: 'SolarSystem', id: number, name: string, security_status?: number | null, constellation?: { __typename?: 'Constellation', id: number, name: string, region?: { __typename?: 'Region', id: number, name: string } | null } | null }, victim?: { __typename?: 'Victim', damageTaken: number, character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null, shipType: { __typename?: 'Type', id: number, name: string, group?: { __typename?: 'ItemGroup', name: string } | null } } | null, finalBlow?: { __typename?: 'Attacker', character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null } | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, currentPage: number, totalPages: number, totalCount: number } } };

export type KillmailsDateCountsQueryVariables = Exact<{
  filter?: InputMaybe<KillmailFilter>;
}>;


export type KillmailsDateCountsQuery = { __typename?: 'Query', killmailsDateCounts: Array<{ __typename?: 'KillmailDateCount', date: string, count: number }> };

export type NewKillmailSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type NewKillmailSubscription = { __typename?: 'Subscription', newKillmail: { __typename?: 'Killmail', id: string, killmailTime: string, totalValue?: number | null, attackerCount: number, solarSystem: { __typename?: 'SolarSystem', id: number, name: string, security_status?: number | null, constellation?: { __typename?: 'Constellation', id: number, name: string, region?: { __typename?: 'Region', name: string } | null } | null }, victim?: { __typename?: 'Victim', damageTaken: number, character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null, shipType: { __typename?: 'Type', id: number, name: string, group?: { __typename?: 'ItemGroup', name: string } | null } } | null, finalBlow?: { __typename?: 'Attacker', character?: { __typename?: 'Character', id: number, name: string } | null, corporation?: { __typename?: 'Corporation', id: number, name: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string } | null } | null } };

export type RegionsQueryVariables = Exact<{
  filter?: InputMaybe<RegionFilter>;
}>;


export type RegionsQuery = { __typename?: 'Query', regions: { __typename?: 'RegionConnection', edges: Array<{ __typename?: 'RegionEdge', cursor: string, node: { __typename?: 'Region', id: number, name: string, description?: string | null, constellationCount: number, solarSystemCount: number, securityStats: { __typename?: 'SecurityStats', highSec: number, lowSec: number, nullSec: number, wormhole: number, avgSecurity?: number | null } } }>, pageInfo: { __typename?: 'PageInfo', currentPage: number, totalPages: number, totalCount: number, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type RegionQueryVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type RegionQuery = { __typename?: 'Query', region?: { __typename?: 'Region', id: number, name: string, description?: string | null, constellationCount: number, solarSystemCount: number, securityStats: { __typename?: 'SecurityStats', highSec: number, lowSec: number, nullSec: number, wormhole: number, avgSecurity?: number | null }, constellations: Array<{ __typename?: 'Constellation', id: number, name: string, solarSystemCount: number, securityStats: { __typename?: 'SecurityStats', highSec: number, lowSec: number, nullSec: number, avgSecurity?: number | null } }> } | null };

export type SearchAlliancesQueryVariables = Exact<{
  search: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SearchAlliancesQuery = { __typename?: 'Query', alliances: { __typename?: 'AllianceConnection', edges: Array<{ __typename?: 'AllianceEdge', node: { __typename?: 'Alliance', id: number, name: string, ticker: string, memberCount: number, corporationCount: number } }> } };

export type SearchCharactersQueryVariables = Exact<{
  search: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SearchCharactersQuery = { __typename?: 'Query', characters: { __typename?: 'CharacterConnection', edges: Array<{ __typename?: 'CharacterEdge', node: { __typename?: 'Character', id: number, name: string, corporation?: { __typename?: 'Corporation', id: number, name: string, ticker: string } | null, alliance?: { __typename?: 'Alliance', id: number, name: string, ticker: string } | null } }> } };

export type SearchCorporationsQueryVariables = Exact<{
  search: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SearchCorporationsQuery = { __typename?: 'Query', corporations: { __typename?: 'CorporationConnection', edges: Array<{ __typename?: 'CorporationEdge', node: { __typename?: 'Corporation', id: number, name: string, ticker: string, member_count: number, alliance?: { __typename?: 'Alliance', id: number, name: string, ticker: string } | null } }> } };

export type SearchTypesQueryVariables = Exact<{
  name: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SearchTypesQuery = { __typename?: 'Query', types: { __typename?: 'TypeConnection', edges: Array<{ __typename?: 'TypeEdge', node: { __typename?: 'Type', id: number, name: string, group?: { __typename?: 'ItemGroup', id: number, name: string } | null } }> } };

export type SolarSystemsQueryVariables = Exact<{
  filter?: InputMaybe<SolarSystemFilter>;
}>;


export type SolarSystemsQuery = { __typename?: 'Query', solarSystems: { __typename?: 'SolarSystemConnection', edges: Array<{ __typename?: 'SolarSystemEdge', cursor: string, node: { __typename?: 'SolarSystem', id: number, name: string, security_status?: number | null, security_class?: string | null, constellation?: { __typename?: 'Constellation', id: number, name: string, region?: { __typename?: 'Region', id: number, name: string } | null } | null } }>, pageInfo: { __typename?: 'PageInfo', currentPage: number, totalPages: number, totalCount: number, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type SolarSystemQueryVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type SolarSystemQuery = { __typename?: 'Query', solarSystem?: { __typename?: 'SolarSystem', id: number, name: string, security_status?: number | null, security_class?: string | null, star_id?: number | null, position?: { __typename?: 'Position', x: number, y: number, z: number } | null, constellation?: { __typename?: 'Constellation', id: number, name: string, region?: { __typename?: 'Region', id: number, name: string } | null } | null } | null };

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
export const AllianceCorporationsDocument = gql`
    query AllianceCorporations($filter: CorporationFilter) {
  corporations(filter: $filter) {
    edges {
      node {
        id
        name
        ticker
        member_count
        ceo {
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
    edges {
      node {
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
          security_status
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
export const AlliancesDocument = gql`
    query Alliances($filter: AllianceFilter) {
  alliances(filter: $filter) {
    edges {
      node {
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
      cursor
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
    security_status
    gender
    description
    title
    updatedAt
    corporation {
      id
      name
      ticker
      member_count
    }
    alliance {
      id
      name
      ticker
      memberCount
    }
    race {
      id
      name
    }
    bloodline {
      id
      name
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
    edges {
      node {
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
          security_status
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
export const CharactersDocument = gql`
    query Characters($filter: CharacterFilter) {
  characters(filter: $filter) {
    edges {
      node {
        id
        name
        security_status
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
      cursor
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
    edges {
      node {
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
      cursor
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
      security_status
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
    query Corporation($id: Int!) {
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
export const CorporationCharactersDocument = gql`
    query CorporationCharacters($filter: CharacterFilter) {
  characters(filter: $filter) {
    edges {
      node {
        id
        name
        security_status
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
    edges {
      node {
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
          security_status
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
export const CorporationsDocument = gql`
    query Corporations($filter: CorporationFilter) {
  corporations(filter: $filter) {
    edges {
      node {
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
      cursor
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
      security_status
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
              itemType {
                id
                name
                jitaPrice {
                  buy
                  sell
                  average
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
              itemType {
                id
                name
                jitaPrice {
                  buy
                  sell
                  average
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
              itemType {
                id
                name
                jitaPrice {
                  buy
                  sell
                  average
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
            itemType {
              id
              name
              jitaPrice {
                buy
                sell
                average
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
    edges {
      node {
        id
        killmailTime
        totalValue
        attackerCount
        solo
        npc
        solarSystem {
          id
          name
          security_status
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
      security_status
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
    edges {
      node {
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
      cursor
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
    edges {
      node {
        id
        name
        ticker
        memberCount
        corporationCount
      }
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
export const SearchCharactersDocument = gql`
    query SearchCharacters($search: String!, $limit: Int = 40) {
  characters(filter: {search: $search, limit: $limit}) {
    edges {
      node {
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
export const SearchCorporationsDocument = gql`
    query SearchCorporations($search: String!, $limit: Int = 40) {
  corporations(filter: {search: $search, limit: $limit}) {
    edges {
      node {
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
export const SearchTypesDocument = gql`
    query SearchTypes($name: String!, $limit: Int = 40) {
  types(
    filter: {name: $name, limit: $limit, categoryList: [6, 22, 23, 40, 65], groupList: [1025]}
  ) {
    edges {
      node {
        id
        name
        group {
          id
          name
        }
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
    edges {
      node {
        id
        name
        security_status
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
      cursor
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
    security_status
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