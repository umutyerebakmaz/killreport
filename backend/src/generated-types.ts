import { GraphQLResolveInfo } from 'graphql';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
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
  corporations?: Maybe<Array<Corporation>>;
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
  alliance_id?: InputMaybe<Scalars['Int']['input']>;
  corporation_id?: InputMaybe<Scalars['Int']['input']>;
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
  implants: Array<FittingModule>;
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
  solarSystem: SolarSystem;
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

export type PageInfo = {
  __typename?: 'PageInfo';
  currentPage: Scalars['Int']['output'];
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  nextCursor?: Maybe<Scalars['Int']['output']>;
  previousCursor?: Maybe<Scalars['Int']['output']>;
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
  /**
   * Fetches the authenticated user's corporation killmails
   * Requires: Authentication + esi-killmails.read_corporation_killmails.v1 scope
   */
  myCorporationKillmails: Array<Killmail>;
  /**
   * Fetches the authenticated user's own killmails
   * Requires: Authentication
   */
  myKillmails: Array<Killmail>;
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


export type QueryMyCorporationKillmailsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryMyKillmailsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
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
  /** Status of standalone workers (non-RabbitMQ) */
  standaloneWorkers: Array<StandaloneWorkerStatus>;
  /** Timestamp of the status check */
  timestamp: Scalars['String']['output'];
};



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;





/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  ActiveUsersPayload: ResolverTypeWrapper<ActiveUsersPayload>;
  Alliance: ResolverTypeWrapper<Alliance>;
  AllianceConnection: ResolverTypeWrapper<AllianceConnection>;
  AllianceEdge: ResolverTypeWrapper<AllianceEdge>;
  AllianceFilter: AllianceFilter;
  AllianceMetrics: ResolverTypeWrapper<AllianceMetrics>;
  AllianceOrderBy: AllianceOrderBy;
  AllianceSnapshot: ResolverTypeWrapper<AllianceSnapshot>;
  Attacker: ResolverTypeWrapper<Attacker>;
  AuthPayload: ResolverTypeWrapper<AuthPayload>;
  AuthUrl: ResolverTypeWrapper<AuthUrl>;
  Bloodline: ResolverTypeWrapper<Bloodline>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  CacheOperation: ResolverTypeWrapper<CacheOperation>;
  CacheStats: ResolverTypeWrapper<CacheStats>;
  Category: ResolverTypeWrapper<Category>;
  CategoryConnection: ResolverTypeWrapper<CategoryConnection>;
  CategoryEdge: ResolverTypeWrapper<CategoryEdge>;
  CategoryFilter: CategoryFilter;
  Character: ResolverTypeWrapper<Character>;
  CharacterConnection: ResolverTypeWrapper<CharacterConnection>;
  CharacterEdge: ResolverTypeWrapper<CharacterEdge>;
  CharacterFilter: CharacterFilter;
  CharacterOrderBy: CharacterOrderBy;
  Constellation: ResolverTypeWrapper<Constellation>;
  ConstellationConnection: ResolverTypeWrapper<ConstellationConnection>;
  ConstellationEdge: ResolverTypeWrapper<ConstellationEdge>;
  ConstellationFilter: ConstellationFilter;
  ConstellationOrderBy: ConstellationOrderBy;
  Corporation: ResolverTypeWrapper<Corporation>;
  CorporationConnection: ResolverTypeWrapper<CorporationConnection>;
  CorporationEdge: ResolverTypeWrapper<CorporationEdge>;
  CorporationFilter: CorporationFilter;
  CorporationMetrics: ResolverTypeWrapper<CorporationMetrics>;
  CorporationOrderBy: CorporationOrderBy;
  CorporationSnapshot: ResolverTypeWrapper<CorporationSnapshot>;
  CreateUserInput: CreateUserInput;
  CreateUserPayload: ResolverTypeWrapper<CreateUserPayload>;
  DogmaAttribute: ResolverTypeWrapper<DogmaAttribute>;
  DogmaAttributeConnection: ResolverTypeWrapper<DogmaAttributeConnection>;
  DogmaAttributeEdge: ResolverTypeWrapper<DogmaAttributeEdge>;
  DogmaAttributeFilter: DogmaAttributeFilter;
  DogmaEffect: ResolverTypeWrapper<DogmaEffect>;
  DogmaEffectConnection: ResolverTypeWrapper<DogmaEffectConnection>;
  DogmaEffectEdge: ResolverTypeWrapper<DogmaEffectEdge>;
  DogmaEffectFilter: DogmaEffectFilter;
  Fitting: ResolverTypeWrapper<Fitting>;
  FittingModule: ResolverTypeWrapper<FittingModule>;
  FittingSlot: ResolverTypeWrapper<FittingSlot>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  ItemGroup: ResolverTypeWrapper<ItemGroup>;
  ItemGroupConnection: ResolverTypeWrapper<ItemGroupConnection>;
  ItemGroupEdge: ResolverTypeWrapper<ItemGroupEdge>;
  ItemGroupFilter: ItemGroupFilter;
  JitaPrice: ResolverTypeWrapper<JitaPrice>;
  Killmail: ResolverTypeWrapper<Killmail>;
  KillmailConnection: ResolverTypeWrapper<KillmailConnection>;
  KillmailDateCount: ResolverTypeWrapper<KillmailDateCount>;
  KillmailEdge: ResolverTypeWrapper<KillmailEdge>;
  KillmailFilter: KillmailFilter;
  KillmailItem: ResolverTypeWrapper<KillmailItem>;
  KillmailOrderBy: KillmailOrderBy;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  PageInfo: ResolverTypeWrapper<PageInfo>;
  Position: ResolverTypeWrapper<Position>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  QueueStatus: ResolverTypeWrapper<QueueStatus>;
  Race: ResolverTypeWrapper<Race>;
  RefreshCharacterResult: ResolverTypeWrapper<RefreshCharacterResult>;
  Region: ResolverTypeWrapper<Region>;
  RegionConnection: ResolverTypeWrapper<RegionConnection>;
  RegionEdge: ResolverTypeWrapper<RegionEdge>;
  RegionFilter: RegionFilter;
  RegionOrderBy: RegionOrderBy;
  SecurityStats: ResolverTypeWrapper<SecurityStats>;
  SlotGroup: ResolverTypeWrapper<SlotGroup>;
  SolarSystem: ResolverTypeWrapper<SolarSystem>;
  SolarSystemConnection: ResolverTypeWrapper<SolarSystemConnection>;
  SolarSystemEdge: ResolverTypeWrapper<SolarSystemEdge>;
  SolarSystemFilter: SolarSystemFilter;
  SolarSystemOrderBy: SolarSystemOrderBy;
  StandaloneWorkerStatus: ResolverTypeWrapper<StandaloneWorkerStatus>;
  StartAllianceSyncInput: StartAllianceSyncInput;
  StartAllianceSyncPayload: ResolverTypeWrapper<StartAllianceSyncPayload>;
  StartCategorySyncInput: StartCategorySyncInput;
  StartCategorySyncPayload: ResolverTypeWrapper<StartCategorySyncPayload>;
  StartConstellationSyncInput: StartConstellationSyncInput;
  StartConstellationSyncPayload: ResolverTypeWrapper<StartConstellationSyncPayload>;
  StartDogmaAttributeSyncInput: StartDogmaAttributeSyncInput;
  StartDogmaAttributeSyncPayload: ResolverTypeWrapper<StartDogmaAttributeSyncPayload>;
  StartDogmaEffectSyncInput: StartDogmaEffectSyncInput;
  StartDogmaEffectSyncPayload: ResolverTypeWrapper<StartDogmaEffectSyncPayload>;
  StartItemGroupSyncInput: StartItemGroupSyncInput;
  StartItemGroupSyncPayload: ResolverTypeWrapper<StartItemGroupSyncPayload>;
  StartRegionSyncInput: StartRegionSyncInput;
  StartRegionSyncPayload: ResolverTypeWrapper<StartRegionSyncPayload>;
  StartTypeDogmaSyncInput: StartTypeDogmaSyncInput;
  StartTypeDogmaSyncPayload: ResolverTypeWrapper<StartTypeDogmaSyncPayload>;
  StartTypeSyncInput: StartTypeSyncInput;
  StartTypeSyncPayload: ResolverTypeWrapper<StartTypeSyncPayload>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Subscription: ResolverTypeWrapper<Record<PropertyKey, never>>;
  SyncMyKillmailsInput: SyncMyKillmailsInput;
  SyncMyKillmailsPayload: ResolverTypeWrapper<SyncMyKillmailsPayload>;
  Type: ResolverTypeWrapper<Type>;
  TypeConnection: ResolverTypeWrapper<TypeConnection>;
  TypeDogmaAttribute: ResolverTypeWrapper<TypeDogmaAttribute>;
  TypeDogmaEffect: ResolverTypeWrapper<TypeDogmaEffect>;
  TypeEdge: ResolverTypeWrapper<TypeEdge>;
  TypeFilter: TypeFilter;
  UpdateUserInput: UpdateUserInput;
  UpdateUserPayload: ResolverTypeWrapper<UpdateUserPayload>;
  User: ResolverTypeWrapper<User>;
  Victim: ResolverTypeWrapper<Victim>;
  WorkerStatus: ResolverTypeWrapper<WorkerStatus>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  ActiveUsersPayload: ActiveUsersPayload;
  Alliance: Alliance;
  AllianceConnection: AllianceConnection;
  AllianceEdge: AllianceEdge;
  AllianceFilter: AllianceFilter;
  AllianceMetrics: AllianceMetrics;
  AllianceSnapshot: AllianceSnapshot;
  Attacker: Attacker;
  AuthPayload: AuthPayload;
  AuthUrl: AuthUrl;
  Bloodline: Bloodline;
  Boolean: Scalars['Boolean']['output'];
  CacheOperation: CacheOperation;
  CacheStats: CacheStats;
  Category: Category;
  CategoryConnection: CategoryConnection;
  CategoryEdge: CategoryEdge;
  CategoryFilter: CategoryFilter;
  Character: Character;
  CharacterConnection: CharacterConnection;
  CharacterEdge: CharacterEdge;
  CharacterFilter: CharacterFilter;
  Constellation: Constellation;
  ConstellationConnection: ConstellationConnection;
  ConstellationEdge: ConstellationEdge;
  ConstellationFilter: ConstellationFilter;
  Corporation: Corporation;
  CorporationConnection: CorporationConnection;
  CorporationEdge: CorporationEdge;
  CorporationFilter: CorporationFilter;
  CorporationMetrics: CorporationMetrics;
  CorporationSnapshot: CorporationSnapshot;
  CreateUserInput: CreateUserInput;
  CreateUserPayload: CreateUserPayload;
  DogmaAttribute: DogmaAttribute;
  DogmaAttributeConnection: DogmaAttributeConnection;
  DogmaAttributeEdge: DogmaAttributeEdge;
  DogmaAttributeFilter: DogmaAttributeFilter;
  DogmaEffect: DogmaEffect;
  DogmaEffectConnection: DogmaEffectConnection;
  DogmaEffectEdge: DogmaEffectEdge;
  DogmaEffectFilter: DogmaEffectFilter;
  Fitting: Fitting;
  FittingModule: FittingModule;
  FittingSlot: FittingSlot;
  Float: Scalars['Float']['output'];
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  ItemGroup: ItemGroup;
  ItemGroupConnection: ItemGroupConnection;
  ItemGroupEdge: ItemGroupEdge;
  ItemGroupFilter: ItemGroupFilter;
  JitaPrice: JitaPrice;
  Killmail: Killmail;
  KillmailConnection: KillmailConnection;
  KillmailDateCount: KillmailDateCount;
  KillmailEdge: KillmailEdge;
  KillmailFilter: KillmailFilter;
  KillmailItem: KillmailItem;
  Mutation: Record<PropertyKey, never>;
  PageInfo: PageInfo;
  Position: Position;
  Query: Record<PropertyKey, never>;
  QueueStatus: QueueStatus;
  Race: Race;
  RefreshCharacterResult: RefreshCharacterResult;
  Region: Region;
  RegionConnection: RegionConnection;
  RegionEdge: RegionEdge;
  RegionFilter: RegionFilter;
  SecurityStats: SecurityStats;
  SlotGroup: SlotGroup;
  SolarSystem: SolarSystem;
  SolarSystemConnection: SolarSystemConnection;
  SolarSystemEdge: SolarSystemEdge;
  SolarSystemFilter: SolarSystemFilter;
  StandaloneWorkerStatus: StandaloneWorkerStatus;
  StartAllianceSyncInput: StartAllianceSyncInput;
  StartAllianceSyncPayload: StartAllianceSyncPayload;
  StartCategorySyncInput: StartCategorySyncInput;
  StartCategorySyncPayload: StartCategorySyncPayload;
  StartConstellationSyncInput: StartConstellationSyncInput;
  StartConstellationSyncPayload: StartConstellationSyncPayload;
  StartDogmaAttributeSyncInput: StartDogmaAttributeSyncInput;
  StartDogmaAttributeSyncPayload: StartDogmaAttributeSyncPayload;
  StartDogmaEffectSyncInput: StartDogmaEffectSyncInput;
  StartDogmaEffectSyncPayload: StartDogmaEffectSyncPayload;
  StartItemGroupSyncInput: StartItemGroupSyncInput;
  StartItemGroupSyncPayload: StartItemGroupSyncPayload;
  StartRegionSyncInput: StartRegionSyncInput;
  StartRegionSyncPayload: StartRegionSyncPayload;
  StartTypeDogmaSyncInput: StartTypeDogmaSyncInput;
  StartTypeDogmaSyncPayload: StartTypeDogmaSyncPayload;
  StartTypeSyncInput: StartTypeSyncInput;
  StartTypeSyncPayload: StartTypeSyncPayload;
  String: Scalars['String']['output'];
  Subscription: Record<PropertyKey, never>;
  SyncMyKillmailsInput: SyncMyKillmailsInput;
  SyncMyKillmailsPayload: SyncMyKillmailsPayload;
  Type: Type;
  TypeConnection: TypeConnection;
  TypeDogmaAttribute: TypeDogmaAttribute;
  TypeDogmaEffect: TypeDogmaEffect;
  TypeEdge: TypeEdge;
  TypeFilter: TypeFilter;
  UpdateUserInput: UpdateUserInput;
  UpdateUserPayload: UpdateUserPayload;
  User: User;
  Victim: Victim;
  WorkerStatus: WorkerStatus;
};

export type ActiveUsersPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['ActiveUsersPayload'] = ResolversParentTypes['ActiveUsersPayload']> = {
  count?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  timestamp?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type AllianceResolvers<ContextType = any, ParentType extends ResolversParentTypes['Alliance'] = ResolversParentTypes['Alliance']> = {
  corporationCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  corporations?: Resolver<Maybe<Array<ResolversTypes['Corporation']>>, ParentType, ContextType>;
  createdBy?: Resolver<Maybe<ResolversTypes['Character']>, ParentType, ContextType>;
  createdByCorporation?: Resolver<Maybe<ResolversTypes['Corporation']>, ParentType, ContextType>;
  date_founded?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  executor?: Resolver<Maybe<ResolversTypes['Corporation']>, ParentType, ContextType>;
  faction_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  memberCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  metrics?: Resolver<Maybe<ResolversTypes['AllianceMetrics']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  snapshots?: Resolver<Array<ResolversTypes['AllianceSnapshot']>, ParentType, ContextType, Partial<AllianceSnapshotsArgs>>;
  ticker?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type AllianceConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['AllianceConnection'] = ResolversParentTypes['AllianceConnection']> = {
  edges?: Resolver<Array<ResolversTypes['AllianceEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type AllianceEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['AllianceEdge'] = ResolversParentTypes['AllianceEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Alliance'], ParentType, ContextType>;
};

export type AllianceMetricsResolvers<ContextType = any, ParentType extends ResolversParentTypes['AllianceMetrics'] = ResolversParentTypes['AllianceMetrics']> = {
  corporationCountDelta1d?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  corporationCountDelta7d?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  corporationCountDelta30d?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  corporationCountGrowthRate1d?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  corporationCountGrowthRate7d?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  corporationCountGrowthRate30d?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  memberCountDelta1d?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  memberCountDelta7d?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  memberCountDelta30d?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  memberCountGrowthRate1d?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  memberCountGrowthRate7d?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  memberCountGrowthRate30d?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
};

export type AllianceSnapshotResolvers<ContextType = any, ParentType extends ResolversParentTypes['AllianceSnapshot'] = ResolversParentTypes['AllianceSnapshot']> = {
  corporationCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  date?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  memberCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type AttackerResolvers<ContextType = any, ParentType extends ResolversParentTypes['Attacker'] = ResolversParentTypes['Attacker']> = {
  alliance?: Resolver<Maybe<ResolversTypes['Alliance']>, ParentType, ContextType>;
  character?: Resolver<Maybe<ResolversTypes['Character']>, ParentType, ContextType>;
  corporation?: Resolver<Maybe<ResolversTypes['Corporation']>, ParentType, ContextType>;
  damageDone?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  factionId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  finalBlow?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  securityStatus?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  shipType?: Resolver<Maybe<ResolversTypes['Type']>, ParentType, ContextType>;
  weaponType?: Resolver<Maybe<ResolversTypes['Type']>, ParentType, ContextType>;
};

export type AuthPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['AuthPayload'] = ResolversParentTypes['AuthPayload']> = {
  accessToken?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  expiresIn?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  refreshToken?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  user?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
};

export type AuthUrlResolvers<ContextType = any, ParentType extends ResolversParentTypes['AuthUrl'] = ResolversParentTypes['AuthUrl']> = {
  state?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  url?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type BloodlineResolvers<ContextType = any, ParentType extends ResolversParentTypes['Bloodline'] = ResolversParentTypes['Bloodline']> = {
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  race?: Resolver<ResolversTypes['Race'], ParentType, ContextType>;
};

export type CacheOperationResolvers<ContextType = any, ParentType extends ResolversParentTypes['CacheOperation'] = ResolversParentTypes['CacheOperation']> = {
  deletedKeys?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type CacheStatsResolvers<ContextType = any, ParentType extends ResolversParentTypes['CacheStats'] = ResolversParentTypes['CacheStats']> = {
  allianceDetailKeys?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  characterDetailKeys?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  corporationDetailKeys?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isHealthy?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  killmailDetailKeys?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  memoryUsage?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  responseCacheKeys?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalKeys?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type CategoryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Category'] = ResolversParentTypes['Category']> = {
  created_at?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  groups?: Resolver<Array<ResolversTypes['ItemGroup']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  published?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  updated_at?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type CategoryConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['CategoryConnection'] = ResolversParentTypes['CategoryConnection']> = {
  edges?: Resolver<Array<ResolversTypes['CategoryEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type CategoryEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['CategoryEdge'] = ResolversParentTypes['CategoryEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Category'], ParentType, ContextType>;
};

export type CharacterResolvers<ContextType = any, ParentType extends ResolversParentTypes['Character'] = ResolversParentTypes['Character']> = {
  alliance?: Resolver<Maybe<ResolversTypes['Alliance']>, ParentType, ContextType>;
  birthday?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  bloodline?: Resolver<Maybe<ResolversTypes['Bloodline']>, ParentType, ContextType>;
  corporation?: Resolver<Maybe<ResolversTypes['Corporation']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  faction_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  gender?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  race?: Resolver<Maybe<ResolversTypes['Race']>, ParentType, ContextType>;
  security_status?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type CharacterConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['CharacterConnection'] = ResolversParentTypes['CharacterConnection']> = {
  edges?: Resolver<Array<ResolversTypes['CharacterEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type CharacterEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['CharacterEdge'] = ResolversParentTypes['CharacterEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Character'], ParentType, ContextType>;
};

export type ConstellationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Constellation'] = ResolversParentTypes['Constellation']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  position?: Resolver<Maybe<ResolversTypes['Position']>, ParentType, ContextType>;
  region?: Resolver<Maybe<ResolversTypes['Region']>, ParentType, ContextType>;
  securityStats?: Resolver<ResolversTypes['SecurityStats'], ParentType, ContextType>;
  solarSystemCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  solarSystems?: Resolver<Array<ResolversTypes['SolarSystem']>, ParentType, ContextType>;
};

export type ConstellationConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['ConstellationConnection'] = ResolversParentTypes['ConstellationConnection']> = {
  edges?: Resolver<Array<ResolversTypes['ConstellationEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type ConstellationEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['ConstellationEdge'] = ResolversParentTypes['ConstellationEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Constellation'], ParentType, ContextType>;
};

export type CorporationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Corporation'] = ResolversParentTypes['Corporation']> = {
  alliance?: Resolver<Maybe<ResolversTypes['Alliance']>, ParentType, ContextType>;
  ceo?: Resolver<Maybe<ResolversTypes['Character']>, ParentType, ContextType>;
  creator?: Resolver<Maybe<ResolversTypes['Character']>, ParentType, ContextType>;
  date_founded?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  faction_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  member_count?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  metrics?: Resolver<Maybe<ResolversTypes['CorporationMetrics']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  snapshots?: Resolver<Array<ResolversTypes['CorporationSnapshot']>, ParentType, ContextType, Partial<CorporationSnapshotsArgs>>;
  tax_rate?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  ticker?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type CorporationConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['CorporationConnection'] = ResolversParentTypes['CorporationConnection']> = {
  edges?: Resolver<Array<ResolversTypes['CorporationEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type CorporationEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['CorporationEdge'] = ResolversParentTypes['CorporationEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Corporation'], ParentType, ContextType>;
};

export type CorporationMetricsResolvers<ContextType = any, ParentType extends ResolversParentTypes['CorporationMetrics'] = ResolversParentTypes['CorporationMetrics']> = {
  memberCountDelta1d?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  memberCountDelta7d?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  memberCountDelta30d?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  memberCountGrowthRate1d?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  memberCountGrowthRate7d?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  memberCountGrowthRate30d?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
};

export type CorporationSnapshotResolvers<ContextType = any, ParentType extends ResolversParentTypes['CorporationSnapshot'] = ResolversParentTypes['CorporationSnapshot']> = {
  date?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  memberCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type CreateUserPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['CreateUserPayload'] = ResolversParentTypes['CreateUserPayload']> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  user?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
};

export type DogmaAttributeResolvers<ContextType = any, ParentType extends ResolversParentTypes['DogmaAttribute'] = ResolversParentTypes['DogmaAttribute']> = {
  created_at?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  default_value?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  display_name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  high_is_good?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  icon_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  published?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  stackable?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  unit_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  updated_at?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type DogmaAttributeConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['DogmaAttributeConnection'] = ResolversParentTypes['DogmaAttributeConnection']> = {
  edges?: Resolver<Array<ResolversTypes['DogmaAttributeEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type DogmaAttributeEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['DogmaAttributeEdge'] = ResolversParentTypes['DogmaAttributeEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['DogmaAttribute'], ParentType, ContextType>;
};

export type DogmaEffectResolvers<ContextType = any, ParentType extends ResolversParentTypes['DogmaEffect'] = ResolversParentTypes['DogmaEffect']> = {
  created_at?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  disallow_auto_repeat?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  display_name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  effect_category?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  icon_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  is_assistance?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  is_offensive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  post_expression?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  pre_expression?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  published?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  updated_at?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type DogmaEffectConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['DogmaEffectConnection'] = ResolversParentTypes['DogmaEffectConnection']> = {
  edges?: Resolver<Array<ResolversTypes['DogmaEffectEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type DogmaEffectEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['DogmaEffectEdge'] = ResolversParentTypes['DogmaEffectEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['DogmaEffect'], ParentType, ContextType>;
};

export type FittingResolvers<ContextType = any, ParentType extends ResolversParentTypes['Fitting'] = ResolversParentTypes['Fitting']> = {
  cargo?: Resolver<Array<ResolversTypes['FittingModule']>, ParentType, ContextType>;
  coreRoom?: Resolver<Array<ResolversTypes['FittingModule']>, ParentType, ContextType>;
  droneBay?: Resolver<Array<ResolversTypes['FittingModule']>, ParentType, ContextType>;
  fighterBay?: Resolver<Array<ResolversTypes['FittingModule']>, ParentType, ContextType>;
  highSlots?: Resolver<ResolversTypes['SlotGroup'], ParentType, ContextType>;
  implants?: Resolver<Array<ResolversTypes['FittingModule']>, ParentType, ContextType>;
  lowSlots?: Resolver<ResolversTypes['SlotGroup'], ParentType, ContextType>;
  midSlots?: Resolver<ResolversTypes['SlotGroup'], ParentType, ContextType>;
  rigs?: Resolver<ResolversTypes['SlotGroup'], ParentType, ContextType>;
  serviceSlots?: Resolver<ResolversTypes['SlotGroup'], ParentType, ContextType>;
  structureFuel?: Resolver<Array<ResolversTypes['FittingModule']>, ParentType, ContextType>;
  subsystems?: Resolver<ResolversTypes['SlotGroup'], ParentType, ContextType>;
};

export type FittingModuleResolvers<ContextType = any, ParentType extends ResolversParentTypes['FittingModule'] = ResolversParentTypes['FittingModule']> = {
  charge?: Resolver<Maybe<ResolversTypes['FittingModule']>, ParentType, ContextType>;
  flag?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  itemType?: Resolver<ResolversTypes['Type'], ParentType, ContextType>;
  quantityDestroyed?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  quantityDropped?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  singleton?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type FittingSlotResolvers<ContextType = any, ParentType extends ResolversParentTypes['FittingSlot'] = ResolversParentTypes['FittingSlot']> = {
  module?: Resolver<Maybe<ResolversTypes['FittingModule']>, ParentType, ContextType>;
  slotIndex?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type ItemGroupResolvers<ContextType = any, ParentType extends ResolversParentTypes['ItemGroup'] = ResolversParentTypes['ItemGroup']> = {
  category?: Resolver<ResolversTypes['Category'], ParentType, ContextType>;
  created_at?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  published?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  types?: Resolver<Array<ResolversTypes['Type']>, ParentType, ContextType>;
  updated_at?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type ItemGroupConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['ItemGroupConnection'] = ResolversParentTypes['ItemGroupConnection']> = {
  edges?: Resolver<Array<ResolversTypes['ItemGroupEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type ItemGroupEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['ItemGroupEdge'] = ResolversParentTypes['ItemGroupEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['ItemGroup'], ParentType, ContextType>;
};

export type JitaPriceResolvers<ContextType = any, ParentType extends ResolversParentTypes['JitaPrice'] = ResolversParentTypes['JitaPrice']> = {
  average?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  buy?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  sell?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  volume?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
};

export type KillmailResolvers<ContextType = any, ParentType extends ResolversParentTypes['Killmail'] = ResolversParentTypes['Killmail']> = {
  attackerCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  attackers?: Resolver<Array<ResolversTypes['Attacker']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  destroyedValue?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  droppedValue?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  finalBlow?: Resolver<Maybe<ResolversTypes['Attacker']>, ParentType, ContextType>;
  fitting?: Resolver<Maybe<ResolversTypes['Fitting']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  items?: Resolver<Array<ResolversTypes['KillmailItem']>, ParentType, ContextType>;
  killmailHash?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  killmailTime?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  solarSystem?: Resolver<ResolversTypes['SolarSystem'], ParentType, ContextType>;
  totalValue?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  victim?: Resolver<Maybe<ResolversTypes['Victim']>, ParentType, ContextType>;
};

export type KillmailConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['KillmailConnection'] = ResolversParentTypes['KillmailConnection']> = {
  edges?: Resolver<Array<ResolversTypes['KillmailEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type KillmailDateCountResolvers<ContextType = any, ParentType extends ResolversParentTypes['KillmailDateCount'] = ResolversParentTypes['KillmailDateCount']> = {
  count?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  date?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type KillmailEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['KillmailEdge'] = ResolversParentTypes['KillmailEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Killmail'], ParentType, ContextType>;
};

export type KillmailItemResolvers<ContextType = any, ParentType extends ResolversParentTypes['KillmailItem'] = ResolversParentTypes['KillmailItem']> = {
  charge?: Resolver<Maybe<ResolversTypes['KillmailItem']>, ParentType, ContextType>;
  flag?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  itemType?: Resolver<ResolversTypes['Type'], ParentType, ContextType>;
  quantityDestroyed?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  quantityDropped?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  singleton?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type MutationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  _empty?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  authenticateWithCode?: Resolver<ResolversTypes['AuthPayload'], ParentType, ContextType, RequireFields<MutationAuthenticateWithCodeArgs, 'code' | 'state'>>;
  clearAllKillmailCaches?: Resolver<ResolversTypes['CacheOperation'], ParentType, ContextType>;
  clearAllianceCache?: Resolver<ResolversTypes['CacheOperation'], ParentType, ContextType, RequireFields<MutationClearAllianceCacheArgs, 'allianceId'>>;
  clearCharacterCache?: Resolver<ResolversTypes['CacheOperation'], ParentType, ContextType, RequireFields<MutationClearCharacterCacheArgs, 'characterId'>>;
  clearCorporationCache?: Resolver<ResolversTypes['CacheOperation'], ParentType, ContextType, RequireFields<MutationClearCorporationCacheArgs, 'corporationId'>>;
  clearKillmailCache?: Resolver<ResolversTypes['CacheOperation'], ParentType, ContextType, RequireFields<MutationClearKillmailCacheArgs, 'killmailId'>>;
  createUser?: Resolver<ResolversTypes['CreateUserPayload'], ParentType, ContextType, RequireFields<MutationCreateUserArgs, 'input'>>;
  login?: Resolver<ResolversTypes['AuthUrl'], ParentType, ContextType>;
  refreshCharacter?: Resolver<ResolversTypes['RefreshCharacterResult'], ParentType, ContextType, RequireFields<MutationRefreshCharacterArgs, 'characterId'>>;
  refreshToken?: Resolver<ResolversTypes['AuthPayload'], ParentType, ContextType, RequireFields<MutationRefreshTokenArgs, 'refreshToken'>>;
  startAllianceSync?: Resolver<ResolversTypes['StartAllianceSyncPayload'], ParentType, ContextType, RequireFields<MutationStartAllianceSyncArgs, 'input'>>;
  startCategorySync?: Resolver<ResolversTypes['StartCategorySyncPayload'], ParentType, ContextType, RequireFields<MutationStartCategorySyncArgs, 'input'>>;
  startConstellationSync?: Resolver<ResolversTypes['StartConstellationSyncPayload'], ParentType, ContextType, RequireFields<MutationStartConstellationSyncArgs, 'input'>>;
  startDogmaAttributeSync?: Resolver<ResolversTypes['StartDogmaAttributeSyncPayload'], ParentType, ContextType, RequireFields<MutationStartDogmaAttributeSyncArgs, 'input'>>;
  startDogmaEffectSync?: Resolver<ResolversTypes['StartDogmaEffectSyncPayload'], ParentType, ContextType, RequireFields<MutationStartDogmaEffectSyncArgs, 'input'>>;
  startItemGroupSync?: Resolver<ResolversTypes['StartItemGroupSyncPayload'], ParentType, ContextType, RequireFields<MutationStartItemGroupSyncArgs, 'input'>>;
  startRegionSync?: Resolver<ResolversTypes['StartRegionSyncPayload'], ParentType, ContextType, RequireFields<MutationStartRegionSyncArgs, 'input'>>;
  startTypeDogmaSync?: Resolver<ResolversTypes['StartTypeDogmaSyncPayload'], ParentType, ContextType, RequireFields<MutationStartTypeDogmaSyncArgs, 'input'>>;
  startTypeSync?: Resolver<ResolversTypes['StartTypeSyncPayload'], ParentType, ContextType, RequireFields<MutationStartTypeSyncArgs, 'input'>>;
  syncMyKillmails?: Resolver<ResolversTypes['SyncMyKillmailsPayload'], ParentType, ContextType, RequireFields<MutationSyncMyKillmailsArgs, 'input'>>;
  updateUser?: Resolver<ResolversTypes['UpdateUserPayload'], ParentType, ContextType, RequireFields<MutationUpdateUserArgs, 'input'>>;
};

export type PageInfoResolvers<ContextType = any, ParentType extends ResolversParentTypes['PageInfo'] = ResolversParentTypes['PageInfo']> = {
  currentPage?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  hasNextPage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  hasPreviousPage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  nextCursor?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  previousCursor?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalPages?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type PositionResolvers<ContextType = any, ParentType extends ResolversParentTypes['Position'] = ResolversParentTypes['Position']> = {
  x?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  y?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  z?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  _empty?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  activeUsersCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  alliance?: Resolver<Maybe<ResolversTypes['Alliance']>, ParentType, ContextType, RequireFields<QueryAllianceArgs, 'id'>>;
  alliances?: Resolver<ResolversTypes['AllianceConnection'], ParentType, ContextType, Partial<QueryAlliancesArgs>>;
  bloodline?: Resolver<Maybe<ResolversTypes['Bloodline']>, ParentType, ContextType, RequireFields<QueryBloodlineArgs, 'id'>>;
  bloodlines?: Resolver<Array<ResolversTypes['Bloodline']>, ParentType, ContextType>;
  cacheStats?: Resolver<ResolversTypes['CacheStats'], ParentType, ContextType>;
  categories?: Resolver<ResolversTypes['CategoryConnection'], ParentType, ContextType, Partial<QueryCategoriesArgs>>;
  category?: Resolver<Maybe<ResolversTypes['Category']>, ParentType, ContextType, RequireFields<QueryCategoryArgs, 'id'>>;
  character?: Resolver<Maybe<ResolversTypes['Character']>, ParentType, ContextType, RequireFields<QueryCharacterArgs, 'id'>>;
  characters?: Resolver<ResolversTypes['CharacterConnection'], ParentType, ContextType, Partial<QueryCharactersArgs>>;
  constellation?: Resolver<Maybe<ResolversTypes['Constellation']>, ParentType, ContextType, RequireFields<QueryConstellationArgs, 'id'>>;
  constellations?: Resolver<ResolversTypes['ConstellationConnection'], ParentType, ContextType, Partial<QueryConstellationsArgs>>;
  corporation?: Resolver<Maybe<ResolversTypes['Corporation']>, ParentType, ContextType, RequireFields<QueryCorporationArgs, 'id'>>;
  corporations?: Resolver<ResolversTypes['CorporationConnection'], ParentType, ContextType, Partial<QueryCorporationsArgs>>;
  dogmaAttribute?: Resolver<Maybe<ResolversTypes['DogmaAttribute']>, ParentType, ContextType, RequireFields<QueryDogmaAttributeArgs, 'id'>>;
  dogmaAttributes?: Resolver<ResolversTypes['DogmaAttributeConnection'], ParentType, ContextType, Partial<QueryDogmaAttributesArgs>>;
  dogmaEffect?: Resolver<Maybe<ResolversTypes['DogmaEffect']>, ParentType, ContextType, RequireFields<QueryDogmaEffectArgs, 'id'>>;
  dogmaEffects?: Resolver<ResolversTypes['DogmaEffectConnection'], ParentType, ContextType, Partial<QueryDogmaEffectsArgs>>;
  itemGroup?: Resolver<Maybe<ResolversTypes['ItemGroup']>, ParentType, ContextType, RequireFields<QueryItemGroupArgs, 'id'>>;
  itemGroups?: Resolver<ResolversTypes['ItemGroupConnection'], ParentType, ContextType, Partial<QueryItemGroupsArgs>>;
  killmail?: Resolver<Maybe<ResolversTypes['Killmail']>, ParentType, ContextType, RequireFields<QueryKillmailArgs, 'id'>>;
  killmails?: Resolver<ResolversTypes['KillmailConnection'], ParentType, ContextType, Partial<QueryKillmailsArgs>>;
  killmailsDateCounts?: Resolver<Array<ResolversTypes['KillmailDateCount']>, ParentType, ContextType, Partial<QueryKillmailsDateCountsArgs>>;
  me?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  myCorporationKillmails?: Resolver<Array<ResolversTypes['Killmail']>, ParentType, ContextType, Partial<QueryMyCorporationKillmailsArgs>>;
  myKillmails?: Resolver<Array<ResolversTypes['Killmail']>, ParentType, ContextType, Partial<QueryMyKillmailsArgs>>;
  race?: Resolver<Maybe<ResolversTypes['Race']>, ParentType, ContextType, RequireFields<QueryRaceArgs, 'id'>>;
  races?: Resolver<Array<ResolversTypes['Race']>, ParentType, ContextType>;
  region?: Resolver<Maybe<ResolversTypes['Region']>, ParentType, ContextType, RequireFields<QueryRegionArgs, 'id'>>;
  regions?: Resolver<ResolversTypes['RegionConnection'], ParentType, ContextType, Partial<QueryRegionsArgs>>;
  solarSystem?: Resolver<Maybe<ResolversTypes['SolarSystem']>, ParentType, ContextType, RequireFields<QuerySolarSystemArgs, 'id'>>;
  solarSystems?: Resolver<ResolversTypes['SolarSystemConnection'], ParentType, ContextType, Partial<QuerySolarSystemsArgs>>;
  type?: Resolver<Maybe<ResolversTypes['Type']>, ParentType, ContextType, RequireFields<QueryTypeArgs, 'id'>>;
  types?: Resolver<ResolversTypes['TypeConnection'], ParentType, ContextType, Partial<QueryTypesArgs>>;
  user?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType, RequireFields<QueryUserArgs, 'id'>>;
  users?: Resolver<Array<ResolversTypes['User']>, ParentType, ContextType>;
  workerStatus?: Resolver<ResolversTypes['WorkerStatus'], ParentType, ContextType>;
};

export type QueueStatusResolvers<ContextType = any, ParentType extends ResolversParentTypes['QueueStatus'] = ResolversParentTypes['QueueStatus']> = {
  active?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  consumerCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  messageCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  workerName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  workerPid?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  workerRunning?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type RaceResolvers<ContextType = any, ParentType extends ResolversParentTypes['Race'] = ResolversParentTypes['Race']> = {
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type RefreshCharacterResultResolvers<ContextType = any, ParentType extends ResolversParentTypes['RefreshCharacterResult'] = ResolversParentTypes['RefreshCharacterResult']> = {
  characterId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  queued?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type RegionResolvers<ContextType = any, ParentType extends ResolversParentTypes['Region'] = ResolversParentTypes['Region']> = {
  constellationCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  constellations?: Resolver<Array<ResolversTypes['Constellation']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  securityStats?: Resolver<ResolversTypes['SecurityStats'], ParentType, ContextType>;
  solarSystemCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type RegionConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['RegionConnection'] = ResolversParentTypes['RegionConnection']> = {
  edges?: Resolver<Array<ResolversTypes['RegionEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type RegionEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['RegionEdge'] = ResolversParentTypes['RegionEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Region'], ParentType, ContextType>;
};

export type SecurityStatsResolvers<ContextType = any, ParentType extends ResolversParentTypes['SecurityStats'] = ResolversParentTypes['SecurityStats']> = {
  avgSecurity?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  highSec?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  lowSec?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  nullSec?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  wormhole?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type SlotGroupResolvers<ContextType = any, ParentType extends ResolversParentTypes['SlotGroup'] = ResolversParentTypes['SlotGroup']> = {
  slots?: Resolver<Array<ResolversTypes['FittingSlot']>, ParentType, ContextType>;
  totalSlots?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type SolarSystemResolvers<ContextType = any, ParentType extends ResolversParentTypes['SolarSystem'] = ResolversParentTypes['SolarSystem']> = {
  constellation?: Resolver<Maybe<ResolversTypes['Constellation']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  position?: Resolver<Maybe<ResolversTypes['Position']>, ParentType, ContextType>;
  security_class?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  security_status?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  star_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
};

export type SolarSystemConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['SolarSystemConnection'] = ResolversParentTypes['SolarSystemConnection']> = {
  edges?: Resolver<Array<ResolversTypes['SolarSystemEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type SolarSystemEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['SolarSystemEdge'] = ResolversParentTypes['SolarSystemEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['SolarSystem'], ParentType, ContextType>;
};

export type StandaloneWorkerStatusResolvers<ContextType = any, ParentType extends ResolversParentTypes['StandaloneWorkerStatus'] = ResolversParentTypes['StandaloneWorkerStatus']> = {
  description?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  pid?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  running?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type StartAllianceSyncPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['StartAllianceSyncPayload'] = ResolversParentTypes['StartAllianceSyncPayload']> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type StartCategorySyncPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['StartCategorySyncPayload'] = ResolversParentTypes['StartCategorySyncPayload']> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type StartConstellationSyncPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['StartConstellationSyncPayload'] = ResolversParentTypes['StartConstellationSyncPayload']> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type StartDogmaAttributeSyncPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['StartDogmaAttributeSyncPayload'] = ResolversParentTypes['StartDogmaAttributeSyncPayload']> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type StartDogmaEffectSyncPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['StartDogmaEffectSyncPayload'] = ResolversParentTypes['StartDogmaEffectSyncPayload']> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type StartItemGroupSyncPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['StartItemGroupSyncPayload'] = ResolversParentTypes['StartItemGroupSyncPayload']> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type StartRegionSyncPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['StartRegionSyncPayload'] = ResolversParentTypes['StartRegionSyncPayload']> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type StartTypeDogmaSyncPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['StartTypeDogmaSyncPayload'] = ResolversParentTypes['StartTypeDogmaSyncPayload']> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  queuedCount?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type StartTypeSyncPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['StartTypeSyncPayload'] = ResolversParentTypes['StartTypeSyncPayload']> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type SubscriptionResolvers<ContextType = any, ParentType extends ResolversParentTypes['Subscription'] = ResolversParentTypes['Subscription']> = {
  _empty?: SubscriptionResolver<Maybe<ResolversTypes['String']>, "_empty", ParentType, ContextType>;
  activeUsersUpdates?: SubscriptionResolver<ResolversTypes['ActiveUsersPayload'], "activeUsersUpdates", ParentType, ContextType>;
  newKillmail?: SubscriptionResolver<ResolversTypes['Killmail'], "newKillmail", ParentType, ContextType>;
  workerStatusUpdates?: SubscriptionResolver<ResolversTypes['WorkerStatus'], "workerStatusUpdates", ParentType, ContextType>;
};

export type SyncMyKillmailsPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['SyncMyKillmailsPayload'] = ResolversParentTypes['SyncMyKillmailsPayload']> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  syncedCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type TypeResolvers<ContextType = any, ParentType extends ResolversParentTypes['Type'] = ResolversParentTypes['Type']> = {
  capacity?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  created_at?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  dogmaAttributes?: Resolver<Array<ResolversTypes['TypeDogmaAttribute']>, ParentType, ContextType, Partial<TypeDogmaAttributesArgs>>;
  dogmaEffects?: Resolver<Array<ResolversTypes['TypeDogmaEffect']>, ParentType, ContextType, Partial<TypeDogmaEffectsArgs>>;
  group?: Resolver<Maybe<ResolversTypes['ItemGroup']>, ParentType, ContextType>;
  icon_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  jitaPrice?: Resolver<Maybe<ResolversTypes['JitaPrice']>, ParentType, ContextType>;
  mass?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  published?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  updated_at?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  volume?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
};

export type TypeConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['TypeConnection'] = ResolversParentTypes['TypeConnection']> = {
  edges?: Resolver<Array<ResolversTypes['TypeEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type TypeDogmaAttributeResolvers<ContextType = any, ParentType extends ResolversParentTypes['TypeDogmaAttribute'] = ResolversParentTypes['TypeDogmaAttribute']> = {
  attribute?: Resolver<ResolversTypes['DogmaAttribute'], ParentType, ContextType>;
  attribute_id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  type_id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  value?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export type TypeDogmaEffectResolvers<ContextType = any, ParentType extends ResolversParentTypes['TypeDogmaEffect'] = ResolversParentTypes['TypeDogmaEffect']> = {
  effect?: Resolver<ResolversTypes['DogmaEffect'], ParentType, ContextType>;
  effect_id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  is_default?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  type_id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type TypeEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['TypeEdge'] = ResolversParentTypes['TypeEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Type'], ParentType, ContextType>;
};

export type UpdateUserPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['UpdateUserPayload'] = ResolversParentTypes['UpdateUserPayload']> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  user?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
};

export type UserResolvers<ContextType = any, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = {
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type VictimResolvers<ContextType = any, ParentType extends ResolversParentTypes['Victim'] = ResolversParentTypes['Victim']> = {
  alliance?: Resolver<Maybe<ResolversTypes['Alliance']>, ParentType, ContextType>;
  character?: Resolver<Maybe<ResolversTypes['Character']>, ParentType, ContextType>;
  corporation?: Resolver<Maybe<ResolversTypes['Corporation']>, ParentType, ContextType>;
  damageTaken?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  factionId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  position?: Resolver<Maybe<ResolversTypes['Position']>, ParentType, ContextType>;
  shipType?: Resolver<ResolversTypes['Type'], ParentType, ContextType>;
};

export type WorkerStatusResolvers<ContextType = any, ParentType extends ResolversParentTypes['WorkerStatus'] = ResolversParentTypes['WorkerStatus']> = {
  databaseSizeMB?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  healthy?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  queues?: Resolver<Array<ResolversTypes['QueueStatus']>, ParentType, ContextType>;
  standaloneWorkers?: Resolver<Array<ResolversTypes['StandaloneWorkerStatus']>, ParentType, ContextType>;
  timestamp?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type Resolvers<ContextType = any> = {
  ActiveUsersPayload?: ActiveUsersPayloadResolvers<ContextType>;
  Alliance?: AllianceResolvers<ContextType>;
  AllianceConnection?: AllianceConnectionResolvers<ContextType>;
  AllianceEdge?: AllianceEdgeResolvers<ContextType>;
  AllianceMetrics?: AllianceMetricsResolvers<ContextType>;
  AllianceSnapshot?: AllianceSnapshotResolvers<ContextType>;
  Attacker?: AttackerResolvers<ContextType>;
  AuthPayload?: AuthPayloadResolvers<ContextType>;
  AuthUrl?: AuthUrlResolvers<ContextType>;
  Bloodline?: BloodlineResolvers<ContextType>;
  CacheOperation?: CacheOperationResolvers<ContextType>;
  CacheStats?: CacheStatsResolvers<ContextType>;
  Category?: CategoryResolvers<ContextType>;
  CategoryConnection?: CategoryConnectionResolvers<ContextType>;
  CategoryEdge?: CategoryEdgeResolvers<ContextType>;
  Character?: CharacterResolvers<ContextType>;
  CharacterConnection?: CharacterConnectionResolvers<ContextType>;
  CharacterEdge?: CharacterEdgeResolvers<ContextType>;
  Constellation?: ConstellationResolvers<ContextType>;
  ConstellationConnection?: ConstellationConnectionResolvers<ContextType>;
  ConstellationEdge?: ConstellationEdgeResolvers<ContextType>;
  Corporation?: CorporationResolvers<ContextType>;
  CorporationConnection?: CorporationConnectionResolvers<ContextType>;
  CorporationEdge?: CorporationEdgeResolvers<ContextType>;
  CorporationMetrics?: CorporationMetricsResolvers<ContextType>;
  CorporationSnapshot?: CorporationSnapshotResolvers<ContextType>;
  CreateUserPayload?: CreateUserPayloadResolvers<ContextType>;
  DogmaAttribute?: DogmaAttributeResolvers<ContextType>;
  DogmaAttributeConnection?: DogmaAttributeConnectionResolvers<ContextType>;
  DogmaAttributeEdge?: DogmaAttributeEdgeResolvers<ContextType>;
  DogmaEffect?: DogmaEffectResolvers<ContextType>;
  DogmaEffectConnection?: DogmaEffectConnectionResolvers<ContextType>;
  DogmaEffectEdge?: DogmaEffectEdgeResolvers<ContextType>;
  Fitting?: FittingResolvers<ContextType>;
  FittingModule?: FittingModuleResolvers<ContextType>;
  FittingSlot?: FittingSlotResolvers<ContextType>;
  ItemGroup?: ItemGroupResolvers<ContextType>;
  ItemGroupConnection?: ItemGroupConnectionResolvers<ContextType>;
  ItemGroupEdge?: ItemGroupEdgeResolvers<ContextType>;
  JitaPrice?: JitaPriceResolvers<ContextType>;
  Killmail?: KillmailResolvers<ContextType>;
  KillmailConnection?: KillmailConnectionResolvers<ContextType>;
  KillmailDateCount?: KillmailDateCountResolvers<ContextType>;
  KillmailEdge?: KillmailEdgeResolvers<ContextType>;
  KillmailItem?: KillmailItemResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  Position?: PositionResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  QueueStatus?: QueueStatusResolvers<ContextType>;
  Race?: RaceResolvers<ContextType>;
  RefreshCharacterResult?: RefreshCharacterResultResolvers<ContextType>;
  Region?: RegionResolvers<ContextType>;
  RegionConnection?: RegionConnectionResolvers<ContextType>;
  RegionEdge?: RegionEdgeResolvers<ContextType>;
  SecurityStats?: SecurityStatsResolvers<ContextType>;
  SlotGroup?: SlotGroupResolvers<ContextType>;
  SolarSystem?: SolarSystemResolvers<ContextType>;
  SolarSystemConnection?: SolarSystemConnectionResolvers<ContextType>;
  SolarSystemEdge?: SolarSystemEdgeResolvers<ContextType>;
  StandaloneWorkerStatus?: StandaloneWorkerStatusResolvers<ContextType>;
  StartAllianceSyncPayload?: StartAllianceSyncPayloadResolvers<ContextType>;
  StartCategorySyncPayload?: StartCategorySyncPayloadResolvers<ContextType>;
  StartConstellationSyncPayload?: StartConstellationSyncPayloadResolvers<ContextType>;
  StartDogmaAttributeSyncPayload?: StartDogmaAttributeSyncPayloadResolvers<ContextType>;
  StartDogmaEffectSyncPayload?: StartDogmaEffectSyncPayloadResolvers<ContextType>;
  StartItemGroupSyncPayload?: StartItemGroupSyncPayloadResolvers<ContextType>;
  StartRegionSyncPayload?: StartRegionSyncPayloadResolvers<ContextType>;
  StartTypeDogmaSyncPayload?: StartTypeDogmaSyncPayloadResolvers<ContextType>;
  StartTypeSyncPayload?: StartTypeSyncPayloadResolvers<ContextType>;
  Subscription?: SubscriptionResolvers<ContextType>;
  SyncMyKillmailsPayload?: SyncMyKillmailsPayloadResolvers<ContextType>;
  Type?: TypeResolvers<ContextType>;
  TypeConnection?: TypeConnectionResolvers<ContextType>;
  TypeDogmaAttribute?: TypeDogmaAttributeResolvers<ContextType>;
  TypeDogmaEffect?: TypeDogmaEffectResolvers<ContextType>;
  TypeEdge?: TypeEdgeResolvers<ContextType>;
  UpdateUserPayload?: UpdateUserPayloadResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
  Victim?: VictimResolvers<ContextType>;
  WorkerStatus?: WorkerStatusResolvers<ContextType>;
};

