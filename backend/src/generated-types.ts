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
  sovereigntySystemCount: Scalars['Int']['output'];
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

/** An alliance ranked by activity level from its latest daily territory snapshot. */
export type AllianceActivityRank = {
  __typename?: 'AllianceActivityRank';
  allianceId: Scalars['Int']['output'];
  allianceName?: Maybe<Scalars['String']['output']>;
  allianceTicker?: Maybe<Scalars['String']['output']>;
  campaignsAttacking: Scalars['Int']['output'];
  campaignsDefending: Scalars['Int']['output'];
  rank: Scalars['Int']['output'];
  systemsGained: Scalars['Int']['output'];
  systemsLost: Scalars['Int']['output'];
};

/** An alliance's defensive record across resolved campaigns it defended. */
export type AllianceDefenseRecord = {
  __typename?: 'AllianceDefenseRecord';
  allianceId: Scalars['Int']['output'];
  allianceName?: Maybe<Scalars['String']['output']>;
  allianceTicker?: Maybe<Scalars['String']['output']>;
  /** Won / total, 0..1. */
  defenseSuccessRate: Scalars['Float']['output'];
  defensesTotal: Scalars['Int']['output'];
  defensesWon: Scalars['Int']['output'];
  rank: Scalars['Int']['output'];
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

/** An alliance ranked by the number of systems it currently holds sovereignty over. */
export type AllianceTerritoryRank = {
  __typename?: 'AllianceTerritoryRank';
  allianceId: Scalars['Int']['output'];
  allianceName?: Maybe<Scalars['String']['output']>;
  allianceTicker?: Maybe<Scalars['String']['output']>;
  /** From the alliance's most recent daily territory snapshot (0 if no snapshot yet). */
  campaignsAttacking: Scalars['Int']['output'];
  campaignsDefending: Scalars['Int']['output'];
  ihubCount: Scalars['Int']['output'];
  rank: Scalars['Int']['output'];
  systemsControlled: Scalars['Int']['output'];
  systemsGained: Scalars['Int']['output'];
  systemsLost: Scalars['Int']['output'];
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

export type AsteroidBelt = {
  __typename?: 'AsteroidBelt';
  id: Scalars['Int']['output'];
  name?: Maybe<Scalars['String']['output']>;
  orbitIndex?: Maybe<Scalars['Int']['output']>;
  planet?: Maybe<Planet>;
  position?: Maybe<Position>;
  solarSystem?: Maybe<SolarSystem>;
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
  /** Token lifetime (seconds) */
  expiresIn: Scalars['Int']['output'];
  /** The authenticated user */
  user: User;
};

export type AuthUrl = {
  __typename?: 'AuthUrl';
  /**
   * State parameter for CSRF protection. Stored on the server and consumed once
   * in the callback.
   */
  state: Scalars['String']['output'];
  /** Eve Online SSO authorization URL */
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

/** An alliance participating in a sovereignty campaign, with its contest score. */
export type CampaignParticipant = {
  __typename?: 'CampaignParticipant';
  allianceId: Scalars['Int']['output'];
  allianceName?: Maybe<Scalars['String']['output']>;
  allianceTicker?: Maybe<Scalars['String']['output']>;
  score: Scalars['Float']['output'];
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

/** A region ranked by sovereignty conflict intensity. */
export type ConflictHotspot = {
  __typename?: 'ConflictHotspot';
  activeCampaigns: Scalars['Int']['output'];
  /** Composite conflict-intensity score (heuristic: activeCampaigns*3 + warKills). */
  intensityScore: Scalars['Float']['output'];
  iskDestroyed: Scalars['Float']['output'];
  regionId: Scalars['Int']['output'];
  regionName?: Maybe<Scalars['String']['output']>;
  warKills: Scalars['Int']['output'];
};

export type Constellation = {
  __typename?: 'Constellation';
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  position?: Maybe<Position>;
  region?: Maybe<Region>;
  solarSystemCount: Scalars['Int']['output'];
  solarSystems: Array<SolarSystem>;
  /**
   * Who holds the constellation, or null where nothing in it is held —
   * wormhole space and unclaimed nullsec, 400 of the 1184 constellations.
   */
  sovereignty?: Maybe<SovereigntyHolder>;
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
  factionId?: InputMaybe<Scalars['Int']['input']>;
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

export type Faction = {
  __typename?: 'Faction';
  corporation?: Maybe<Corporation>;
  corporationId?: Maybe<Scalars['Int']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  memberCharacterCount: Scalars['Int']['output'];
  memberCorporationCount: Scalars['Int']['output'];
  militiaCorporation?: Maybe<Corporation>;
  militiaCorporationId?: Maybe<Scalars['Int']['output']>;
  name: Scalars['String']['output'];
  solarSystem?: Maybe<SolarSystem>;
  sovereigntySystemCount: Scalars['Int']['output'];
  stationCount?: Maybe<Scalars['Int']['output']>;
  stationSystemCount?: Maybe<Scalars['Int']['output']>;
};

export type FactionTopTarget = {
  __typename?: 'FactionTopTarget';
  faction: Faction;
  killCount: Scalars['Int']['output'];
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
  fuelBay: Array<FittingModule>;
  gasHold: Array<FittingModule>;
  highSlots: SlotGroup;
  iceHold: Array<FittingModule>;
  implants: SlotGroup;
  infrastructureHangar: Array<FittingModule>;
  infrastructureHold: Array<FittingModule>;
  lowSlots: SlotGroup;
  midSlots: SlotGroup;
  mineralHold: Array<FittingModule>;
  oreHold: Array<FittingModule>;
  planetaryCommoditiesHold: Array<FittingModule>;
  rigs: SlotGroup;
  salvageHold: Array<FittingModule>;
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
  /** Whether this kill was correlated to an active sovereignty war campaign. */
  isWarRelated: Scalars['Boolean']['output'];
  items: Array<KillmailItem>;
  killmailHash: Scalars['String']['output'];
  killmailTime: Scalars['String']['output'];
  /** The celestial the victim died nearest to. Null when ESI gave no position. */
  location?: Maybe<KillmailLocation>;
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
  endDate?: InputMaybe<Scalars['String']['input']>;
  factionId?: InputMaybe<Scalars['Int']['input']>;
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
  /**
   * Only ships of this tier, from types.meta_group_id. Combined with shipTypeId
   * or shipGroupIds it narrows them, and it follows the same victim / attacker
   * choice.
   */
  shipTier?: InputMaybe<ShipTierFilter>;
  shipTypeId?: InputMaybe<Scalars['Int']['input']>;
  startDate?: InputMaybe<Scalars['String']['input']>;
  systemId?: InputMaybe<Scalars['Int']['input']>;
  victim?: InputMaybe<Scalars['Boolean']['input']>;
  /** Only return killmails correlated to an active sovereignty campaign. */
  warRelated?: InputMaybe<Scalars['Boolean']['input']>;
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

/**
 * The nearest of the system's star, planets, moons, asteroid belts, NPC stations
 * and stargates to where the victim died. Player-owned structures are never
 * among them, so a kill beside a citadel reads as its distance to the nearest
 * of these.
 */
export type KillmailLocation = {
  __typename?: 'KillmailLocation';
  /** Metres from the victim to the celestial. */
  distance: Scalars['Float']['output'];
  id: Scalars['Int']['output'];
  kind: MapCelestialKind;
  name?: Maybe<Scalars['String']['output']>;
};

export enum KillmailOrderBy {
  TimeAsc = 'timeAsc',
  TimeDesc = 'timeDesc',
  ValueAsc = 'valueAsc',
  ValueDesc = 'valueDesc'
}

export type KillmailsResponse = {
  __typename?: 'KillmailsResponse';
  items: Array<Killmail>;
  pageInfo: PageInfo;
};

export enum LeaderboardPeriod {
  Last_7Days = 'LAST_7_DAYS',
  Last_90Days = 'LAST_90_DAYS',
  Month = 'MONTH',
  Today = 'TODAY',
  Week = 'WEEK'
}

/** Bounds of the nodes in the scene, in metres. The camera's autofit comes from here. */
export type MapBounds = {
  __typename?: 'MapBounds';
  maxX: Scalars['Float']['output'];
  maxZ: Scalars['Float']['output'];
  minX: Scalars['Float']['output'];
  minZ: Scalars['Float']['output'];
};

/**
 * A single object inside a system. Coordinates are **relative to the system centre**,
 * in metres, and unlike the nodes **not rounded**: the innermost planet orbits at
 * 2.4145e10 m, and a 1e9 grid would shift it by 4%.
 */
export type MapCelestial = {
  __typename?: 'MapCelestial';
  /** Set only on GATE: the system at the other end of the line. Anchoring the gate end relies on it. */
  destinationSystemId?: Maybe<Scalars['Int']['output']>;
  id: Scalars['Int']['output'];
  kind: MapCelestialKind;
  name?: Maybe<Scalars['String']['output']>;
  /** ESI's 1-based position; set for planets, moons and belts, null for the rest. */
  orbitIndex?: Maybe<Scalars['Int']['output']>;
  /** The planet a moon or belt belongs to; null for the rest. */
  planetId?: Maybe<Scalars['Int']['output']>;
  systemId: Scalars['Int']['output'];
  x: Scalars['Float']['output'];
  z: Scalars['Float']['output'];
};

/** The kind of drawable object inside a system. */
export enum MapCelestialKind {
  Belt = 'BELT',
  Gate = 'GATE',
  Moon = 'MOON',
  Planet = 'PLANET',
  Star = 'STAR',
  Station = 'STATION'
}

/** A gate pair. Each pair appears once, from < to. */
export type MapEdge = {
  __typename?: 'MapEdge';
  from: Scalars['Int']['output'];
  to: Scalars['Int']['output'];
};

export type MapGeometry = {
  __typename?: 'MapGeometry';
  bounds: MapBounds;
  edges: Array<MapEdge>;
  nodes: Array<MapNode>;
  scope: MapScope;
};

/**
 * A name on the map. Coordinates are in **galactic metres**, the same space as the nodes.
 * A region has no position, so it is computed from the medoid of the systems the scene
 * draws; a constellation uses constellations.position_x/z directly.
 */
export type MapLabel = {
  __typename?: 'MapLabel';
  /** REGION only: bounds of the region's drawn systems. The name's visibility threshold comes from here. */
  bounds?: Maybe<MapBounds>;
  /** region_id for a region, constellation_id for a constellation. The ranges do not overlap, but a consumer that wants a single key should key on it together with kind. */
  id: Scalars['Int']['output'];
  kind: MapLabelKind;
  name: Scalars['String']['output'];
  /** REGION only: the medoid system the name is anchored to. The client reads its radius from mapGeometry. */
  systemId?: Maybe<Scalars['Int']['output']>;
  x: Scalars['Float']['output'];
  z: Scalars['Float']['output'];
};

/** A label's tier. System names are not here because they come from mapGeometry. */
export enum MapLabelKind {
  Constellation = 'CONSTELLATION',
  Region = 'REGION'
}

/** A system at its galactic position. Coordinates are rounded to 1e9 m and never reach the GPU raw. */
export type MapNode = {
  __typename?: 'MapNode';
  constellationId: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  /** Distance to the farthest celestial in the x/z plane, in metres. The dot turns into a disc at this radius. */
  radius: Scalars['Float']['output'];
  regionId: Scalars['Int']['output'];
  /** TRUNCATED to two decimals, not rounded: rounding moves 14 systems into highsec. */
  securityStatus: Scalars['Float']['output'];
  systemId: Scalars['Int']['output'];
  x: Scalars['Float']['output'];
  z: Scalars['Float']['output'];
};

/** The kind of thing that holds a system. If the row has an alliance, that is the owner; a corporation owns only when there is no alliance. */
export enum MapOwnerKind {
  Alliance = 'ALLIANCE',
  Corporation = 'CORPORATION',
  Faction = 'FACTION'
}

/** A drawable scene. Abyssal, Proving and GPMR-01 are not here: they contain zero planets, moons and stations. */
export enum MapScope {
  NewEden = 'NEW_EDEN',
  Pochven = 'POCHVEN',
  Wormhole = 'WORMHOLE'
}

/**
 * A single owner holding territory in the scene. Its name is not repeated in
 * `systems`; the two lists join on `ownerId`.
 */
export type MapSovOwner = {
  __typename?: 'MapSovOwner';
  kind: MapOwnerKind;
  name: Scalars['String']['output'];
  ownerId: Scalars['Int']['output'];
  systemCount: Scalars['Int']['output'];
  /** Null for a faction: the factions table has no ticker column. */
  ticker?: Maybe<Scalars['String']['output']>;
};

/** A single ownership pair. 5,383 rows in NEW_EDEN. */
export type MapSovSystem = {
  __typename?: 'MapSovSystem';
  ownerId: Scalars['Int']['output'];
  systemId: Scalars['Int']['output'];
};

export type MapSovereignty = {
  __typename?: 'MapSovereignty';
  owners: Array<MapSovOwner>;
  scope: MapScope;
  systems: Array<MapSovSystem>;
  /** How fresh the snapshot is, ISO. Null when there are no rows. */
  updatedAt?: Maybe<Scalars['String']['output']>;
};

/**
 * Everything a system's popup shows, in one query.
 *
 * Why not `solarSystem(id)`, when all of it could be read from there: that coordinate
 * stays in the response cache for **365 days** (`config/cache.ts`, `STATIC_GAME_DATA`),
 * so hourly data read through it freezes for a year. The detail page's own "2 hours ago"
 * line freezes today for exactly this reason; that is not carried over here.
 */
export type MapSystemDetails = {
  __typename?: 'MapSystemDetails';
  constellationName: Scalars['String']['output'];
  name: Scalars['String']['output'];
  npcKills?: Maybe<Scalars['Int']['output']>;
  /** Whoever holds the system. Null in unclaimed space, which is most of New Eden. */
  owner?: Maybe<MapSystemOwner>;
  podKills?: Maybe<Scalars['Int']['output']>;
  regionName: Scalars['String']['output'];
  /** TRUNCATED to two decimals, same as MapNode.securityStatus: rounding moves 14 systems into highsec. */
  securityStatus?: Maybe<Scalars['Float']['output']>;
  /** Can be null even when a row exists: if ESI left the system out of the jumps list. 0 means it reported it and there were no jumps. */
  shipJumps?: Maybe<Scalars['Int']['output']>;
  /** The latest snapshot. All four are null if the system has no row at all. */
  shipKills?: Maybe<Scalars['Int']['output']>;
  /** The snapshot time, ISO. Null when all four numbers are null. */
  snapshotAt?: Maybe<Scalars['String']['output']>;
  /**
   * The real list from the `stargates` table. Deriving it from `mapGeometry.edges`
   * comes up SHORT: there both ends of an edge must be inside the scope, so a gate
   * leading out of the scope never shows. The count is not carried separately — the
   * list's length already is that, and two sources for one number drift apart.
   */
  stargates: Array<MapSystemStargate>;
  systemId: Scalars['Int']['output'];
};

/**
 * The owner of a single system. It comes from the SAME COALESCE rule as `mapSovereignty`:
 * the SQL fragments are shared from `map-sovereignty.service`, so the popup cannot
 * contradict the owner the colour beneath it shows.
 */
export type MapSystemOwner = {
  __typename?: 'MapSystemOwner';
  kind: MapOwnerKind;
  name: Scalars['String']['output'];
  ownerId: Scalars['Int']['output'];
  /** Null for a faction: the factions table has no ticker column. */
  ticker?: Maybe<Scalars['String']['output']>;
};

/**
 * A single gate leading out of the system, and where it opens.
 *
 * The name carried is the DESTINATION system's, not the gate's own: the name in the
 * database is already `Stargate (Perimeter)`, and repeating "Stargate" on eight of
 * eight rows in a list headed Stargates tells the reader nothing.
 */
export type MapSystemStargate = {
  __typename?: 'MapSystemStargate';
  destinationName: Scalars['String']['output'];
  /**
   * The destination's security status, TRUNCATED to two decimals by the SAME rule
   * as `MapSystemDetails.securityStatus`. Nullable because the column is — measured
   * 2026-09-20: set on all 13,978 destinations, so it never returns null today.
   */
  destinationSecurityStatus?: Maybe<Scalars['Float']['output']>;
  destinationSystemId: Scalars['Int']['output'];
  stargateId: Scalars['Int']['output'];
};

export type Moon = {
  __typename?: 'Moon';
  id: Scalars['Int']['output'];
  name?: Maybe<Scalars['String']['output']>;
  /** 1-based position in ESI's planets[].moons array. */
  orbitIndex?: Maybe<Scalars['Int']['output']>;
  planet?: Maybe<Planet>;
  position?: Maybe<Position>;
  solarSystem?: Maybe<SolarSystem>;
};

/** Which losses a Most Valuable shelf ranks. Always the victim's hull. */
export enum MostValuableScope {
  /** Carriers, dreadnoughts, supercarriers, titans, FAXes, capital industrials. */
  Capitals = 'CAPITALS',
  /** Everything except structures and pods. Capitals are included. */
  Ships = 'SHIPS',
  /** Kills with a single attacker, excluding structures and pods. */
  Solo = 'SOLO',
  /** Citadels, engineering complexes, refineries and starbases. */
  Structures = 'STRUCTURES'
}

export type Mutation = {
  __typename?: 'Mutation';
  _empty?: Maybe<Scalars['String']['output']>;
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
  /**
   * Builds the authorization URL for Eve Online SSO login.
   *
   * `returnTo` is the relative path of the page where login was clicked; the user
   * lands there after SSO. Any value pointing off-site is treated as `/`.
   */
  login: AuthUrl;
  /** Ends this session and clears the cookie */
  logout: Scalars['Boolean']['output'];
  refreshCharacter: RefreshCharacterResult;
  /** Gets a fresh EVE access token using the session cookie */
  refreshSession: AuthPayload;
  /** Ends another of the user's sessions */
  revokeSession: Scalars['Boolean']['output'];
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


export type MutationLoginArgs = {
  returnTo?: InputMaybe<Scalars['String']['input']>;
};


export type MutationRefreshCharacterArgs = {
  characterId: Scalars['Int']['input'];
};


export type MutationRevokeSessionArgs = {
  id: Scalars['ID']['input'];
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

export type Planet = {
  __typename?: 'Planet';
  asteroidBelts: Array<AsteroidBelt>;
  id: Scalars['Int']['output'];
  moons: Array<Moon>;
  name?: Maybe<Scalars['String']['output']>;
  /** 1-based position in ESI's planets[] array. */
  orbitIndex?: Maybe<Scalars['Int']['output']>;
  position?: Maybe<Position>;
  solarSystem?: Maybe<SolarSystem>;
  /** Barren, Gas, Temperate, Storm… */
  type?: Maybe<Type>;
  typeId?: Maybe<Scalars['Int']['output']>;
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
  /** Active sovereignty campaigns grouped by region, hottest first. */
  activeCampaignsByRegion: Array<RegionCampaignCount>;
  activeUsersCount: Scalars['Int']['output'];
  alliance?: Maybe<Alliance>;
  /** Top alliances ranked by number of systems currently controlled. */
  allianceTerritoryRankings: Array<AllianceTerritoryRank>;
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
  /** Regions ranked by sovereignty conflict intensity, hottest first. */
  conflictHotspots: Array<ConflictHotspot>;
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
  faction?: Maybe<Faction>;
  factionTopCharacters: Array<CharacterTopTarget>;
  factionTopCorporations: Array<CorporationTopTarget>;
  factionTopFactionTargets: Array<FactionTopTarget>;
  factionTopShipTargets: Array<ShipTopKill>;
  factionTopShips: Array<ShipTopKill>;
  factions: Array<Faction>;
  itemGroup?: Maybe<ItemGroup>;
  itemGroups: ItemGroupsResponse;
  /** Fetches a single killmail */
  killmail?: Maybe<Killmail>;
  /** Lists all killmails with pagination */
  killmails: KillmailsResponse;
  /** Returns count of killmails grouped by date (for the current filter) */
  killmailsDateCounts: Array<KillmailDateCount>;
  /**
   * The insides of the given systems. At most **16 systems**; more are rejected,
   * not silently truncated — a shortened list draws a scene with holes.
   * Cached per system, 86400 s.
   */
  mapCelestials: Array<MapCelestial>;
  /**
   * Static universe data. The service keeps it in Redis for 86400 s, but the
   * freshness seen through the API is the response cache's STATIC_GAME_DATA: 365
   * days. A universe backfill does not reach the map until the cache is cleared.
   */
  mapGeometry: MapGeometry;
  /**
   * The names of one tier of the given scene. Static universe data; the service keeps
   * it in Redis for 86400 s, and the freshness seen through the API is the response
   * cache's STATIC_GAME_DATA.
   */
  mapLabels: Array<MapLabel>;
  /**
   * The scene's sovereignty layer. The service keeps it in Redis for 900 s.
   *
   * Left out of the response cache **on purpose**: added to `PUBLIC_CACHE_QUERIES`,
   * its TTL would also have to go into `TTL_PER_SCHEMA_COORDINATE`, and with the
   * service's own Redis key already doing the job a second layer would only double
   * the staleness.
   */
  mapSovereignty: MapSovereignty;
  /**
   * The single query the popup reads. Cached per system for 300 s — the shortest-lived
   * part of it is the activity, which changes every hour.
   */
  mapSystemDetails?: Maybe<MapSystemDetails>;
  /** Returns the currently authenticated user */
  me?: Maybe<User>;
  /** Alliances ranked by campaigns currently attacking (most aggressive first). */
  mostAggressiveAlliances: Array<AllianceActivityRank>;
  /** Alliances ranked by campaigns currently defending (most defensive first). */
  mostDefensiveAlliances: Array<AllianceActivityRank>;
  /**
   * Top killmails by ISK value in a trailing window, most valuable first.
   * Scope is matched against the victim's hull, never an attacker's.
   */
  mostValuableKillmails: Array<Killmail>;
  /** The user's open sessions */
  mySessions: Array<Session>;
  race?: Maybe<Race>;
  races: Array<Race>;
  /** Most recently detected territory ownership changes. */
  recentTerritoryChanges: Array<TerritoryChange>;
  region?: Maybe<Region>;
  regions: RegionsResponse;
  solarSystem?: Maybe<SolarSystem>;
  solarSystemStats: SolarSystemStats;
  solarSystems: SolarSystemsResponse;
  /** Currently active sovereignty campaigns, newest first. */
  sovereigntyActiveCampaigns: Array<SovereigntyCampaign>;
  /** Resolved (ended) campaigns, newest-ended first, paginated. */
  sovereigntyCampaignHistory: SovereigntyCampaignHistoryPage;
  /** Distribution of resolved campaign outcomes. */
  sovereigntyOutcomeStats: SovereigntyOutcomeStats;
  /** Summary counts for the current sovereignty state. */
  sovereigntyOverview: SovereigntyOverview;
  /** All currently tracked (non-destroyed) sovereignty structures, optionally filtered. */
  sovereigntyStructures: Array<SovereigntyStructureInfo>;
  /** Structures whose vulnerability window opens within the next N hours (default 24), soonest first. */
  sovereigntyUpcomingTimers: Array<SovereigntyStructureInfo>;
  systemActivityHistory: Array<SystemActivity>;
  systemLatestActivity?: Maybe<SystemActivity>;
  topActiveSystems: Array<SystemActivityStats>;
  /** Top alliances by kill count over the window named by filter.period. */
  topAlliances: Array<TopAlliance>;
  /**
   * Ships attackers flew most often over the window named by filter.period.
   * Counts attacker rows, so a five-ship fleet counts five.
   */
  topAttackerShips: Array<TopShip>;
  /** Top corporations by kill count over the window named by filter.period. */
  topCorporations: Array<TopCorporation>;
  /** Alliances ranked by successful defenses of ended campaigns. */
  topDefenders: Array<AllianceDefenseRecord>;
  /** Ships destroyed most often over the window named by filter.period. */
  topDestroyedShips: Array<TopShip>;
  /**
   * Factions whose members scored the most kills over the window named by
   * filter.period. Counts distinct killmails, so a twenty-strong militia fleet
   * counts once for that kill.
   */
  topFactions: Array<TopFaction>;
  /** Top pilots by kill count over the window named by filter.period. */
  topPilots: Array<TopPilot>;
  /** Regions with the most kills over the window named by filter.period. */
  topRegions: Array<TopRegion>;
  /** Systems with the most kills over the window named by filter.period. */
  topSystems: Array<TopSystem>;
  type?: Maybe<Type>;
  types: TypesResponse;
  user?: Maybe<User>;
  users: Array<User>;
  /** Get current status of all workers and queues */
  workerStatus: WorkerStatus;
};


export type QueryActiveCampaignsByRegionArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryAllianceArgs = {
  id: Scalars['Int']['input'];
};


export type QueryAllianceTerritoryRankingsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
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


export type QueryConflictHotspotsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
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


export type QueryFactionArgs = {
  id: Scalars['Int']['input'];
};


export type QueryFactionTopCharactersArgs = {
  factionId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
};


export type QueryFactionTopCorporationsArgs = {
  factionId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
};


export type QueryFactionTopFactionTargetsArgs = {
  factionId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
};


export type QueryFactionTopShipTargetsArgs = {
  factionId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
};


export type QueryFactionTopShipsArgs = {
  factionId: Scalars['Int']['input'];
  filter?: InputMaybe<TopTargetFilter>;
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


export type QueryMapCelestialsArgs = {
  systemIds: Array<Scalars['Int']['input']>;
};


export type QueryMapGeometryArgs = {
  scope?: MapScope;
};


export type QueryMapLabelsArgs = {
  kind: MapLabelKind;
  scope?: MapScope;
};


export type QueryMapSovereigntyArgs = {
  scope?: MapScope;
};


export type QueryMapSystemDetailsArgs = {
  systemId: Scalars['Int']['input'];
};


export type QueryMostAggressiveAlliancesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryMostDefensiveAlliancesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryMostValuableKillmailsArgs = {
  days?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  regionId?: InputMaybe<Scalars['Int']['input']>;
  scope: MostValuableScope;
};


export type QueryRaceArgs = {
  id: Scalars['Int']['input'];
};


export type QueryRecentTerritoryChangesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
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


export type QuerySolarSystemStatsArgs = {
  systemId: Scalars['Int']['input'];
};


export type QuerySolarSystemsArgs = {
  filter?: InputMaybe<SolarSystemFilter>;
};


export type QuerySovereigntyActiveCampaignsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  systemId?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerySovereigntyCampaignHistoryArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerySovereigntyStructuresArgs = {
  allianceId?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  systemId?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerySovereigntyUpcomingTimersArgs = {
  hoursAhead?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerySystemActivityHistoryArgs = {
  filter: SystemActivityFilter;
};


export type QuerySystemLatestActivityArgs = {
  system_id: Scalars['Int']['input'];
};


export type QueryTopActiveSystemsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryTopAlliancesArgs = {
  filter?: InputMaybe<TopFilter>;
};


export type QueryTopAttackerShipsArgs = {
  filter?: InputMaybe<TopFilter>;
};


export type QueryTopCorporationsArgs = {
  filter?: InputMaybe<TopFilter>;
};


export type QueryTopDefendersArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryTopDestroyedShipsArgs = {
  filter?: InputMaybe<TopFilter>;
};


export type QueryTopFactionsArgs = {
  filter?: InputMaybe<TopFilter>;
};


export type QueryTopPilotsArgs = {
  filter?: InputMaybe<TopFilter>;
};


export type QueryTopRegionsArgs = {
  filter?: InputMaybe<TopFilter>;
};


export type QueryTopSystemsArgs = {
  filter?: InputMaybe<TopFilter>;
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

/** A queue's health as read from its counts. */
export enum QueueHealth {
  Ok = 'OK',
  Stalled = 'STALLED'
}

export type QueueStatus = {
  __typename?: 'QueueStatus';
  /** Is there at least one active consumer */
  active: Scalars['Boolean']['output'];
  /** Number of active consumers processing from this queue */
  consumerCount: Scalars['Int']['output'];
  /**
   * The queue's health, derived from its own counts. STALLED = messages, no consumer.
   * `killreport.wait` and `killreport.parking` are exempt: holding messages is their job.
   */
  health: QueueHealth;
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
  solarSystemCount: Scalars['Int']['output'];
  /**
   * Who holds the region, or null where nothing in it is held — 44 of the 114
   * regions, wormhole space among them.
   */
  sovereignty?: Maybe<SovereigntyHolder>;
};

/** Count of active sovereignty campaigns in a region. */
export type RegionCampaignCount = {
  __typename?: 'RegionCampaignCount';
  campaignCount: Scalars['Int']['output'];
  regionId: Scalars['Int']['output'];
  regionName?: Maybe<Scalars['String']['output']>;
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

export type Session = {
  __typename?: 'Session';
  createdAt: Scalars['String']['output'];
  /** Whether this is the session of the cookie carrying this request */
  current: Scalars['Boolean']['output'];
  expiresAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  ip?: Maybe<Scalars['String']['output']>;
  lastSeenAt: Scalars['String']['output'];
  userAgent?: Maybe<Scalars['String']['output']>;
};

/**
 * A ship tier for the killmail filter, by the type's meta group: TECH2 is 2,
 * TECH3 is 14, FACTION is 3 and 4 (Storyline and Faction/Navy/Fleet), the
 * groups the ship tier badge draws.
 */
export enum ShipTierFilter {
  Faction = 'FACTION',
  Tech2 = 'TECH2',
  Tech3 = 'TECH3'
}

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
  counts: SolarSystemCounts;
  id: Scalars['Int']['output'];
  latestActivity?: Maybe<SystemActivity>;
  name: Scalars['String']['output'];
  planets: Array<Planet>;
  position?: Maybe<Position>;
  securityStatus?: Maybe<Scalars['Float']['output']>;
  security_class?: Maybe<Scalars['String']['output']>;
  /** Unnamed until step 3 runs; null when star_id is empty. */
  star?: Maybe<Star>;
  star_id?: Maybe<Scalars['Int']['output']>;
  stargates: Array<Stargate>;
  stations: Array<Station>;
};

export type SolarSystemCounts = {
  __typename?: 'SolarSystemCounts';
  asteroidBelts: Scalars['Int']['output'];
  moons: Scalars['Int']['output'];
  planets: Scalars['Int']['output'];
  sovereigntyStructures: Scalars['Int']['output'];
  stargates: Scalars['Int']['output'];
  stations: Scalars['Int']['output'];
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
  NpcKillsAsc = 'npcKillsAsc',
  NpcKillsDesc = 'npcKillsDesc',
  PodKillsAsc = 'podKillsAsc',
  PodKillsDesc = 'podKillsDesc',
  SecurityStatusAsc = 'securityStatusAsc',
  SecurityStatusDesc = 'securityStatusDesc',
  ShipKillsAsc = 'shipKillsAsc',
  ShipKillsDesc = 'shipKillsDesc'
}

export type SolarSystemStats = {
  __typename?: 'SolarSystemStats';
  /** The UTC hour with the most kills over the last 7 days (0-23). */
  busiestHourUtc?: Maybe<Scalars['Int']['output']>;
  iskDestroyed7d: Scalars['Float']['output'];
  kills7d: Scalars['Int']['output'];
  kills24h: Scalars['Int']['output'];
  lastKillTime?: Maybe<Scalars['String']['output']>;
  systemId: Scalars['Int']['output'];
  totalIskDestroyed: Scalars['Float']['output'];
  totalKills: Scalars['Int']['output'];
};

export type SolarSystemsResponse = {
  __typename?: 'SolarSystemsResponse';
  items: Array<SolarSystem>;
  pageInfo: PageInfo;
};

/** A real-time sovereignty alert pushed over SSE when a worker detects an event. */
export type SovereigntyAlert = {
  __typename?: 'SovereigntyAlert';
  /** The salient alliance for the event (defender, or new owner). */
  allianceId?: Maybe<Scalars['Int']['output']>;
  allianceName?: Maybe<Scalars['String']['output']>;
  allianceTicker?: Maybe<Scalars['String']['output']>;
  /** Set for territory_change: captured / lost / transferred / faction_change. */
  changeType?: Maybe<Scalars['String']['output']>;
  /** Human-readable summary, e.g. 'New IHub campaign in EH2I-P (Perrigen Falls)'. */
  message: Scalars['String']['output'];
  /** Set for campaign_ended: defender_won / attacker_won / abandoned. */
  outcome?: Maybe<Scalars['String']['output']>;
  regionName?: Maybe<Scalars['String']['output']>;
  solarSystemId: Scalars['Int']['output'];
  solarSystemName?: Maybe<Scalars['String']['output']>;
  timestamp: Scalars['String']['output'];
  /** campaign_started | campaign_ended | territory_change */
  type: Scalars['String']['output'];
};

/** An active sovereignty campaign (contested TCU / IHub / station). */
export type SovereigntyCampaign = {
  __typename?: 'SovereigntyCampaign';
  /** ISK lost by the attacker/third-party side. */
  attackerIskLost: Scalars['Float']['output'];
  attackerShipsLost: Scalars['Int']['output'];
  attackersScore?: Maybe<Scalars['Float']['output']>;
  campaignId: Scalars['Int']['output'];
  constellationId: Scalars['Int']['output'];
  defenderId?: Maybe<Scalars['Int']['output']>;
  /** ISK lost by the defender side (victim alliance == defender). */
  defenderIskLost: Scalars['Float']['output'];
  defenderName?: Maybe<Scalars['String']['output']>;
  defenderScore?: Maybe<Scalars['Float']['output']>;
  defenderShipsLost: Scalars['Int']['output'];
  defenderTicker?: Maybe<Scalars['String']['output']>;
  /** Hours from start to end; null while active. */
  durationHours?: Maybe<Scalars['Float']['output']>;
  /** Set once the campaign resolves and leaves ESI; null while active. */
  endTime?: Maybe<Scalars['String']['output']>;
  eventType: Scalars['String']['output'];
  /** ISK destroyed in this campaign's war zone. */
  iskDestroyed: Scalars['Float']['output'];
  /** defender_won / attacker_won / abandoned; null while active or unresolved. */
  outcome?: Maybe<Scalars['String']['output']>;
  /** Alliances contesting this campaign (attackers and/or defender) with their score. */
  participants: Array<CampaignParticipant>;
  regionId?: Maybe<Scalars['Int']['output']>;
  regionName?: Maybe<Scalars['String']['output']>;
  solarSystemId: Scalars['Int']['output'];
  solarSystemName?: Maybe<Scalars['String']['output']>;
  startTime: Scalars['String']['output'];
  structureId: Scalars['String']['output'];
  /** When the campaign worker last wrote this row. The map reads the newest one to say how fresh its timers are. */
  updatedAt: Scalars['String']['output'];
  /** Killmails correlated to this campaign (0 until fighting happens in its window). */
  warKills: Scalars['Int']['output'];
};

/** A page of resolved (ended) sovereignty campaigns. */
export type SovereigntyCampaignHistoryPage = {
  __typename?: 'SovereigntyCampaignHistoryPage';
  items: Array<SovereigntyCampaign>;
  totalCount: Scalars['Int']['output'];
};

/**
 * Who holds a region or a constellation. EVE tracks sovereignty per solar
 * system, so this is the owner of the most of its systems, and `systemCount`
 * says how thin or wide that majority is — read the two together, never the
 * name alone.
 *
 * A constellation is usually undivided: 739 of the 784 held ones have a single
 * owner throughout, and none mixes a faction with an alliance. A region is not.
 * 31 of the 70 held regions have more than one owner, 4 of them across both
 * kinds, and the leader averages 82% of the region's held systems but drops to
 * 20% at the thinnest. Providence, for one, is reported to its largest holder
 * on 24 of its 84 systems.
 */
export type SovereigntyHolder = {
  __typename?: 'SovereigntyHolder';
  /** The alliance's ticker; null for a faction. */
  allianceTicker?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['Int']['output'];
  ownerName?: Maybe<Scalars['String']['output']>;
  ownerType: SovereigntyOwnerType;
  /** How many of the systems below it this owner holds. */
  systemCount: Scalars['Int']['output'];
};

/** Distribution of resolved campaign outcomes. */
export type SovereigntyOutcomeStats = {
  __typename?: 'SovereigntyOutcomeStats';
  abandoned: Scalars['Int']['output'];
  attackerWon: Scalars['Int']['output'];
  defenderWon: Scalars['Int']['output'];
  totalResolved: Scalars['Int']['output'];
};

/** High-level summary of the current sovereignty state. */
export type SovereigntyOverview = {
  __typename?: 'SovereigntyOverview';
  activeCampaigns: Scalars['Int']['output'];
  /** Total ISK destroyed across all active sovereignty campaigns. */
  iskDestroyed: Scalars['Float']['output'];
  ownedSystems: Scalars['Int']['output'];
  trackedAlliances: Scalars['Int']['output'];
  trackedStructures: Scalars['Int']['output'];
  /** Total killmails correlated to active sovereignty campaigns. */
  warKills: Scalars['Int']['output'];
};

/** FACTION in NPC space, ALLIANCE in sovereign space. */
export enum SovereigntyOwnerType {
  Alliance = 'ALLIANCE',
  Faction = 'FACTION'
}

/** A tracked sovereignty structure (IHub or TCU) with ownership and timer info. */
export type SovereigntyStructureInfo = {
  __typename?: 'SovereigntyStructureInfo';
  allianceId: Scalars['Int']['output'];
  allianceName?: Maybe<Scalars['String']['output']>;
  allianceTicker?: Maybe<Scalars['String']['output']>;
  firstSeen: Scalars['String']['output'];
  lastSeen: Scalars['String']['output'];
  /** Vulnerability occupancy level (ADM proxy), 1.0..6.0, if reported by ESI. */
  occupancyLevel?: Maybe<Scalars['Float']['output']>;
  regionId?: Maybe<Scalars['Int']['output']>;
  regionName?: Maybe<Scalars['String']['output']>;
  solarSystemId: Scalars['Int']['output'];
  solarSystemName?: Maybe<Scalars['String']['output']>;
  structureId: Scalars['String']['output'];
  structureTypeId: Scalars['Int']['output'];
  structureTypeName: Scalars['String']['output'];
  vulnerableEndTime?: Maybe<Scalars['String']['output']>;
  vulnerableStartTime?: Maybe<Scalars['String']['output']>;
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

export type Star = {
  __typename?: 'Star';
  /** Years. */
  age?: Maybe<Scalars['Float']['output']>;
  id: Scalars['Int']['output'];
  luminosity?: Maybe<Scalars['Float']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  /** Metres. */
  radius?: Maybe<Scalars['Float']['output']>;
  solarSystem?: Maybe<SolarSystem>;
  /** E.g. "M2 V". */
  spectralClass?: Maybe<Scalars['String']['output']>;
  /** Kelvin. */
  temperature?: Maybe<Scalars['Int']['output']>;
  type?: Maybe<Type>;
  typeId?: Maybe<Scalars['Int']['output']>;
};

/** A stargate in the system. Mirrors ESI's stargates[] array, with its ends resolved. */
export type Stargate = {
  __typename?: 'Stargate';
  destination?: Maybe<StargateDestination>;
  id: Scalars['Int']['output'];
  name?: Maybe<Scalars['String']['output']>;
  position?: Maybe<Position>;
  solarSystem?: Maybe<SolarSystem>;
  type?: Maybe<Type>;
  typeId?: Maybe<Scalars['Int']['output']>;
};

/**
 * The destination object from ESI's stargate response.
 * The raw IDs are null until step 3 runs; the objects are also null when the
 * matching row is not in the database.
 */
export type StargateDestination = {
  __typename?: 'StargateDestination';
  destinationStargateId?: Maybe<Scalars['Int']['output']>;
  destinationSystemId?: Maybe<Scalars['Int']['output']>;
  /** The stargate at the far end; its own destination points back to this system. */
  stargate?: Maybe<Stargate>;
  /** The system at the far end. */
  system?: Maybe<SolarSystem>;
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

export type Station = {
  __typename?: 'Station';
  id: Scalars['Int']['output'];
  maxDockableShipVolume?: Maybe<Scalars['Float']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  /** Office rental cost in ISK. */
  officeRentalCost?: Maybe<Scalars['Float']['output']>;
  ownerCorporation?: Maybe<Corporation>;
  ownerCorporationId?: Maybe<Scalars['Int']['output']>;
  position?: Maybe<Position>;
  raceId?: Maybe<Scalars['Int']['output']>;
  reprocessingEfficiency?: Maybe<Scalars['Float']['output']>;
  /** The station's cut of reprocessing; 0.05 = 5%. */
  reprocessingStationsTake?: Maybe<Scalars['Float']['output']>;
  services: Array<Scalars['String']['output']>;
  solarSystem?: Maybe<SolarSystem>;
  type?: Maybe<Type>;
  typeId?: Maybe<Scalars['Int']['output']>;
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
  /** Live sovereignty alerts (new/ended campaigns, territory changes). */
  sovereigntyAlert: SovereigntyAlert;
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

export type SystemActivity = {
  __typename?: 'SystemActivity';
  id: Scalars['Int']['output'];
  npc_kills: Scalars['Int']['output'];
  pod_kills: Scalars['Int']['output'];
  ship_jumps?: Maybe<Scalars['Int']['output']>;
  ship_kills: Scalars['Int']['output'];
  solar_system?: Maybe<SolarSystem>;
  system_id: Scalars['Int']['output'];
  timestamp: Scalars['String']['output'];
};

export type SystemActivityFilter = {
  hours?: InputMaybe<Scalars['Int']['input']>;
  system_id: Scalars['Int']['input'];
};

export type SystemActivityStats = {
  __typename?: 'SystemActivityStats';
  latest_npc_kills?: Maybe<Scalars['Int']['output']>;
  latest_pod_kills?: Maybe<Scalars['Int']['output']>;
  latest_ship_kills?: Maybe<Scalars['Int']['output']>;
  latest_timestamp?: Maybe<Scalars['String']['output']>;
  system_id: Scalars['Int']['output'];
  system_name: Scalars['String']['output'];
  total_kills: Scalars['Int']['output'];
};

/** A logged change of sovereignty ownership for a system. */
export type TerritoryChange = {
  __typename?: 'TerritoryChange';
  changeType: Scalars['String']['output'];
  detectedAt: Scalars['String']['output'];
  id: Scalars['String']['output'];
  newOwnerId?: Maybe<Scalars['Int']['output']>;
  newOwnerName?: Maybe<Scalars['String']['output']>;
  previousOwnerId?: Maybe<Scalars['Int']['output']>;
  previousOwnerName?: Maybe<Scalars['String']['output']>;
  solarSystemId: Scalars['Int']['output'];
  solarSystemName?: Maybe<Scalars['String']['output']>;
};

export type TopAlliance = {
  __typename?: 'TopAlliance';
  alliance?: Maybe<Alliance>;
  killCount: Scalars['Int']['output'];
  rank: Scalars['Int']['output'];
};

export type TopCorporation = {
  __typename?: 'TopCorporation';
  corporation?: Maybe<Corporation>;
  killCount: Scalars['Int']['output'];
  rank: Scalars['Int']['output'];
};

export type TopFaction = {
  __typename?: 'TopFaction';
  faction?: Maybe<Faction>;
  killCount: Scalars['Int']['output'];
  rank: Scalars['Int']['output'];
};

export type TopFilter = {
  /**
   * Anchors the period. YYYY-MM-DD for TODAY, any day of the target week for
   * WEEK (rounded back to its Monday), YYYY-MM for MONTH. Ignored by the rolling
   * windows LAST_7_DAYS and LAST_90_DAYS. Empty means today / this week / this month.
   */
  anchor?: InputMaybe<Scalars['String']['input']>;
  constellationId?: InputMaybe<Scalars['Int']['input']>;
  /** Max 100; default 100 */
  limit?: InputMaybe<Scalars['Int']['input']>;
  /** Defaults to LAST_7_DAYS. */
  period?: InputMaybe<LeaderboardPeriod>;
  regionId?: InputMaybe<Scalars['Int']['input']>;
  systemId?: InputMaybe<Scalars['Int']['input']>;
};

export type TopPilot = {
  __typename?: 'TopPilot';
  character?: Maybe<Character>;
  killCount: Scalars['Int']['output'];
  rank: Scalars['Int']['output'];
};

export type TopRegion = {
  __typename?: 'TopRegion';
  killCount: Scalars['Int']['output'];
  rank: Scalars['Int']['output'];
  region?: Maybe<Region>;
};

export type TopShip = {
  __typename?: 'TopShip';
  killCount: Scalars['Int']['output'];
  rank: Scalars['Int']['output'];
  shipType?: Maybe<Type>;
};

export type TopSystem = {
  __typename?: 'TopSystem';
  killCount: Scalars['Int']['output'];
  rank: Scalars['Int']['output'];
  solarSystem?: Maybe<SolarSystem>;
};

export enum TopTargetFilter {
  AllTime = 'ALL_TIME',
  Last_7Days = 'LAST_7_DAYS',
  Last_90Days = 'LAST_90_DAYS',
  Today = 'TODAY'
}

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
  /**
   * The type's meta group: 1 Tech I, 2 Tech II, 3 Storyline, 4 Faction,
   * 5 Officer, 6 Deadspace, 14 Tech III, and so on. From CCP's Static Data
   * Export rather than ESI, which does not carry it; null for a type with none,
   * or one added since `yarn sde:meta-groups` last ran.
   */
  metaGroupId?: Maybe<Scalars['Int']['output']>;
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
  AllianceActivityRank: ResolverTypeWrapper<AllianceActivityRank>;
  AllianceDefenseRecord: ResolverTypeWrapper<AllianceDefenseRecord>;
  AllianceFilter: AllianceFilter;
  AllianceMetrics: ResolverTypeWrapper<AllianceMetrics>;
  AllianceOrderBy: AllianceOrderBy;
  AllianceSnapshot: ResolverTypeWrapper<AllianceSnapshot>;
  AllianceTerritoryRank: ResolverTypeWrapper<AllianceTerritoryRank>;
  AllianceTopTarget: ResolverTypeWrapper<AllianceTopTarget>;
  AlliancesResponse: ResolverTypeWrapper<AlliancesResponse>;
  AsteroidBelt: ResolverTypeWrapper<AsteroidBelt>;
  Attacker: ResolverTypeWrapper<Attacker>;
  AuthPayload: ResolverTypeWrapper<AuthPayload>;
  AuthUrl: ResolverTypeWrapper<AuthUrl>;
  Bloodline: ResolverTypeWrapper<Bloodline>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  CacheOperation: ResolverTypeWrapper<CacheOperation>;
  CacheStats: ResolverTypeWrapper<CacheStats>;
  CampaignParticipant: ResolverTypeWrapper<CampaignParticipant>;
  CategoriesResponse: ResolverTypeWrapper<CategoriesResponse>;
  Category: ResolverTypeWrapper<Category>;
  CategoryFilter: CategoryFilter;
  Character: ResolverTypeWrapper<Character>;
  CharacterFilter: CharacterFilter;
  CharacterOrderBy: CharacterOrderBy;
  CharacterTopTarget: ResolverTypeWrapper<CharacterTopTarget>;
  CharactersResponse: ResolverTypeWrapper<CharactersResponse>;
  ConflictHotspot: ResolverTypeWrapper<ConflictHotspot>;
  Constellation: ResolverTypeWrapper<Constellation>;
  ConstellationFilter: ConstellationFilter;
  ConstellationOrderBy: ConstellationOrderBy;
  ConstellationsResponse: ResolverTypeWrapper<ConstellationsResponse>;
  Corporation: ResolverTypeWrapper<Corporation>;
  CorporationFilter: CorporationFilter;
  CorporationMetrics: ResolverTypeWrapper<CorporationMetrics>;
  CorporationOrderBy: CorporationOrderBy;
  CorporationSnapshot: ResolverTypeWrapper<CorporationSnapshot>;
  CorporationTopTarget: ResolverTypeWrapper<CorporationTopTarget>;
  CorporationsResponse: ResolverTypeWrapper<CorporationsResponse>;
  CreateUserInput: CreateUserInput;
  CreateUserPayload: ResolverTypeWrapper<CreateUserPayload>;
  DogmaAttribute: ResolverTypeWrapper<DogmaAttribute>;
  DogmaAttributeFilter: DogmaAttributeFilter;
  DogmaAttributesResponse: ResolverTypeWrapper<DogmaAttributesResponse>;
  DogmaEffect: ResolverTypeWrapper<DogmaEffect>;
  DogmaEffectFilter: DogmaEffectFilter;
  DogmaEffectsResponse: ResolverTypeWrapper<DogmaEffectsResponse>;
  Faction: ResolverTypeWrapper<Faction>;
  FactionTopTarget: ResolverTypeWrapper<FactionTopTarget>;
  Fitting: ResolverTypeWrapper<Fitting>;
  FittingModule: ResolverTypeWrapper<FittingModule>;
  FittingSlot: ResolverTypeWrapper<FittingSlot>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  ItemGroup: ResolverTypeWrapper<ItemGroup>;
  ItemGroupFilter: ItemGroupFilter;
  ItemGroupsResponse: ResolverTypeWrapper<ItemGroupsResponse>;
  JitaPrice: ResolverTypeWrapper<JitaPrice>;
  Killmail: ResolverTypeWrapper<Killmail>;
  KillmailDateCount: ResolverTypeWrapper<KillmailDateCount>;
  KillmailFilter: KillmailFilter;
  KillmailItem: ResolverTypeWrapper<KillmailItem>;
  KillmailLocation: ResolverTypeWrapper<KillmailLocation>;
  KillmailOrderBy: KillmailOrderBy;
  KillmailsResponse: ResolverTypeWrapper<KillmailsResponse>;
  LeaderboardPeriod: LeaderboardPeriod;
  MapBounds: ResolverTypeWrapper<MapBounds>;
  MapCelestial: ResolverTypeWrapper<MapCelestial>;
  MapCelestialKind: MapCelestialKind;
  MapEdge: ResolverTypeWrapper<MapEdge>;
  MapGeometry: ResolverTypeWrapper<MapGeometry>;
  MapLabel: ResolverTypeWrapper<MapLabel>;
  MapLabelKind: MapLabelKind;
  MapNode: ResolverTypeWrapper<MapNode>;
  MapOwnerKind: MapOwnerKind;
  MapScope: MapScope;
  MapSovOwner: ResolverTypeWrapper<MapSovOwner>;
  MapSovSystem: ResolverTypeWrapper<MapSovSystem>;
  MapSovereignty: ResolverTypeWrapper<MapSovereignty>;
  MapSystemDetails: ResolverTypeWrapper<MapSystemDetails>;
  MapSystemOwner: ResolverTypeWrapper<MapSystemOwner>;
  MapSystemStargate: ResolverTypeWrapper<MapSystemStargate>;
  Moon: ResolverTypeWrapper<Moon>;
  MostValuableScope: MostValuableScope;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  PageInfo: ResolverTypeWrapper<PageInfo>;
  Planet: ResolverTypeWrapper<Planet>;
  Position: ResolverTypeWrapper<Position>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  QueueHealth: QueueHealth;
  QueueStatus: ResolverTypeWrapper<QueueStatus>;
  Race: ResolverTypeWrapper<Race>;
  RedisMetrics: ResolverTypeWrapper<RedisMetrics>;
  RefreshCharacterResult: ResolverTypeWrapper<RefreshCharacterResult>;
  Region: ResolverTypeWrapper<Region>;
  RegionCampaignCount: ResolverTypeWrapper<RegionCampaignCount>;
  RegionFilter: RegionFilter;
  RegionOrderBy: RegionOrderBy;
  RegionsResponse: ResolverTypeWrapper<RegionsResponse>;
  Session: ResolverTypeWrapper<Session>;
  ShipTierFilter: ShipTierFilter;
  ShipTopKill: ResolverTypeWrapper<ShipTopKill>;
  SlotGroup: ResolverTypeWrapper<SlotGroup>;
  SolarSystem: ResolverTypeWrapper<SolarSystem>;
  SolarSystemCounts: ResolverTypeWrapper<SolarSystemCounts>;
  SolarSystemFilter: SolarSystemFilter;
  SolarSystemOrderBy: SolarSystemOrderBy;
  SolarSystemStats: ResolverTypeWrapper<SolarSystemStats>;
  SolarSystemsResponse: ResolverTypeWrapper<SolarSystemsResponse>;
  SovereigntyAlert: ResolverTypeWrapper<SovereigntyAlert>;
  SovereigntyCampaign: ResolverTypeWrapper<SovereigntyCampaign>;
  SovereigntyCampaignHistoryPage: ResolverTypeWrapper<SovereigntyCampaignHistoryPage>;
  SovereigntyHolder: ResolverTypeWrapper<SovereigntyHolder>;
  SovereigntyOutcomeStats: ResolverTypeWrapper<SovereigntyOutcomeStats>;
  SovereigntyOverview: ResolverTypeWrapper<SovereigntyOverview>;
  SovereigntyOwnerType: SovereigntyOwnerType;
  SovereigntyStructureInfo: ResolverTypeWrapper<SovereigntyStructureInfo>;
  StandaloneWorkerStatus: ResolverTypeWrapper<StandaloneWorkerStatus>;
  Star: ResolverTypeWrapper<Star>;
  Stargate: ResolverTypeWrapper<Stargate>;
  StargateDestination: ResolverTypeWrapper<StargateDestination>;
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
  Station: ResolverTypeWrapper<Station>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Subscription: ResolverTypeWrapper<Record<PropertyKey, never>>;
  SyncMyKillmailsInput: SyncMyKillmailsInput;
  SyncMyKillmailsPayload: ResolverTypeWrapper<SyncMyKillmailsPayload>;
  SystemActivity: ResolverTypeWrapper<SystemActivity>;
  SystemActivityFilter: SystemActivityFilter;
  SystemActivityStats: ResolverTypeWrapper<SystemActivityStats>;
  TerritoryChange: ResolverTypeWrapper<TerritoryChange>;
  TopAlliance: ResolverTypeWrapper<TopAlliance>;
  TopCorporation: ResolverTypeWrapper<TopCorporation>;
  TopFaction: ResolverTypeWrapper<TopFaction>;
  TopFilter: TopFilter;
  TopPilot: ResolverTypeWrapper<TopPilot>;
  TopRegion: ResolverTypeWrapper<TopRegion>;
  TopShip: ResolverTypeWrapper<TopShip>;
  TopSystem: ResolverTypeWrapper<TopSystem>;
  TopTargetFilter: TopTargetFilter;
  Type: ResolverTypeWrapper<Type>;
  TypeDogmaAttribute: ResolverTypeWrapper<TypeDogmaAttribute>;
  TypeDogmaEffect: ResolverTypeWrapper<TypeDogmaEffect>;
  TypeFilter: TypeFilter;
  TypesResponse: ResolverTypeWrapper<TypesResponse>;
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
  AllianceActivityRank: AllianceActivityRank;
  AllianceDefenseRecord: AllianceDefenseRecord;
  AllianceFilter: AllianceFilter;
  AllianceMetrics: AllianceMetrics;
  AllianceSnapshot: AllianceSnapshot;
  AllianceTerritoryRank: AllianceTerritoryRank;
  AllianceTopTarget: AllianceTopTarget;
  AlliancesResponse: AlliancesResponse;
  AsteroidBelt: AsteroidBelt;
  Attacker: Attacker;
  AuthPayload: AuthPayload;
  AuthUrl: AuthUrl;
  Bloodline: Bloodline;
  Boolean: Scalars['Boolean']['output'];
  CacheOperation: CacheOperation;
  CacheStats: CacheStats;
  CampaignParticipant: CampaignParticipant;
  CategoriesResponse: CategoriesResponse;
  Category: Category;
  CategoryFilter: CategoryFilter;
  Character: Character;
  CharacterFilter: CharacterFilter;
  CharacterTopTarget: CharacterTopTarget;
  CharactersResponse: CharactersResponse;
  ConflictHotspot: ConflictHotspot;
  Constellation: Constellation;
  ConstellationFilter: ConstellationFilter;
  ConstellationsResponse: ConstellationsResponse;
  Corporation: Corporation;
  CorporationFilter: CorporationFilter;
  CorporationMetrics: CorporationMetrics;
  CorporationSnapshot: CorporationSnapshot;
  CorporationTopTarget: CorporationTopTarget;
  CorporationsResponse: CorporationsResponse;
  CreateUserInput: CreateUserInput;
  CreateUserPayload: CreateUserPayload;
  DogmaAttribute: DogmaAttribute;
  DogmaAttributeFilter: DogmaAttributeFilter;
  DogmaAttributesResponse: DogmaAttributesResponse;
  DogmaEffect: DogmaEffect;
  DogmaEffectFilter: DogmaEffectFilter;
  DogmaEffectsResponse: DogmaEffectsResponse;
  Faction: Faction;
  FactionTopTarget: FactionTopTarget;
  Fitting: Fitting;
  FittingModule: FittingModule;
  FittingSlot: FittingSlot;
  Float: Scalars['Float']['output'];
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  ItemGroup: ItemGroup;
  ItemGroupFilter: ItemGroupFilter;
  ItemGroupsResponse: ItemGroupsResponse;
  JitaPrice: JitaPrice;
  Killmail: Killmail;
  KillmailDateCount: KillmailDateCount;
  KillmailFilter: KillmailFilter;
  KillmailItem: KillmailItem;
  KillmailLocation: KillmailLocation;
  KillmailsResponse: KillmailsResponse;
  MapBounds: MapBounds;
  MapCelestial: MapCelestial;
  MapEdge: MapEdge;
  MapGeometry: MapGeometry;
  MapLabel: MapLabel;
  MapNode: MapNode;
  MapSovOwner: MapSovOwner;
  MapSovSystem: MapSovSystem;
  MapSovereignty: MapSovereignty;
  MapSystemDetails: MapSystemDetails;
  MapSystemOwner: MapSystemOwner;
  MapSystemStargate: MapSystemStargate;
  Moon: Moon;
  Mutation: Record<PropertyKey, never>;
  PageInfo: PageInfo;
  Planet: Planet;
  Position: Position;
  Query: Record<PropertyKey, never>;
  QueueStatus: QueueStatus;
  Race: Race;
  RedisMetrics: RedisMetrics;
  RefreshCharacterResult: RefreshCharacterResult;
  Region: Region;
  RegionCampaignCount: RegionCampaignCount;
  RegionFilter: RegionFilter;
  RegionsResponse: RegionsResponse;
  Session: Session;
  ShipTopKill: ShipTopKill;
  SlotGroup: SlotGroup;
  SolarSystem: SolarSystem;
  SolarSystemCounts: SolarSystemCounts;
  SolarSystemFilter: SolarSystemFilter;
  SolarSystemStats: SolarSystemStats;
  SolarSystemsResponse: SolarSystemsResponse;
  SovereigntyAlert: SovereigntyAlert;
  SovereigntyCampaign: SovereigntyCampaign;
  SovereigntyCampaignHistoryPage: SovereigntyCampaignHistoryPage;
  SovereigntyHolder: SovereigntyHolder;
  SovereigntyOutcomeStats: SovereigntyOutcomeStats;
  SovereigntyOverview: SovereigntyOverview;
  SovereigntyStructureInfo: SovereigntyStructureInfo;
  StandaloneWorkerStatus: StandaloneWorkerStatus;
  Star: Star;
  Stargate: Stargate;
  StargateDestination: StargateDestination;
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
  Station: Station;
  String: Scalars['String']['output'];
  Subscription: Record<PropertyKey, never>;
  SyncMyKillmailsInput: SyncMyKillmailsInput;
  SyncMyKillmailsPayload: SyncMyKillmailsPayload;
  SystemActivity: SystemActivity;
  SystemActivityFilter: SystemActivityFilter;
  SystemActivityStats: SystemActivityStats;
  TerritoryChange: TerritoryChange;
  TopAlliance: TopAlliance;
  TopCorporation: TopCorporation;
  TopFaction: TopFaction;
  TopFilter: TopFilter;
  TopPilot: TopPilot;
  TopRegion: TopRegion;
  TopShip: TopShip;
  TopSystem: TopSystem;
  Type: Type;
  TypeDogmaAttribute: TypeDogmaAttribute;
  TypeDogmaEffect: TypeDogmaEffect;
  TypeFilter: TypeFilter;
  TypesResponse: TypesResponse;
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
  corporations?: Resolver<Array<ResolversTypes['Corporation']>, ParentType, ContextType>;
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
  sovereigntySystemCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  ticker?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  topAllianceTargets?: Resolver<Array<ResolversTypes['AllianceTopTarget']>, ParentType, ContextType, Partial<AllianceTopAllianceTargetsArgs>>;
  topCorporationTargets?: Resolver<Array<ResolversTypes['CorporationTopTarget']>, ParentType, ContextType, Partial<AllianceTopCorporationTargetsArgs>>;
  topShipTargets?: Resolver<Array<ResolversTypes['ShipTopKill']>, ParentType, ContextType, Partial<AllianceTopShipTargetsArgs>>;
};

export type AllianceActivityRankResolvers<ContextType = any, ParentType extends ResolversParentTypes['AllianceActivityRank'] = ResolversParentTypes['AllianceActivityRank']> = {
  allianceId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  allianceName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  allianceTicker?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  campaignsAttacking?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  campaignsDefending?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  rank?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  systemsGained?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  systemsLost?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type AllianceDefenseRecordResolvers<ContextType = any, ParentType extends ResolversParentTypes['AllianceDefenseRecord'] = ResolversParentTypes['AllianceDefenseRecord']> = {
  allianceId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  allianceName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  allianceTicker?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  defenseSuccessRate?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  defensesTotal?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  defensesWon?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  rank?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
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

export type AllianceTerritoryRankResolvers<ContextType = any, ParentType extends ResolversParentTypes['AllianceTerritoryRank'] = ResolversParentTypes['AllianceTerritoryRank']> = {
  allianceId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  allianceName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  allianceTicker?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  campaignsAttacking?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  campaignsDefending?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  ihubCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  rank?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  systemsControlled?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  systemsGained?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  systemsLost?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type AllianceTopTargetResolvers<ContextType = any, ParentType extends ResolversParentTypes['AllianceTopTarget'] = ResolversParentTypes['AllianceTopTarget']> = {
  alliance?: Resolver<ResolversTypes['Alliance'], ParentType, ContextType>;
  killCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type AlliancesResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['AlliancesResponse'] = ResolversParentTypes['AlliancesResponse']> = {
  items?: Resolver<Array<ResolversTypes['Alliance']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type AsteroidBeltResolvers<ContextType = any, ParentType extends ResolversParentTypes['AsteroidBelt'] = ResolversParentTypes['AsteroidBelt']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  orbitIndex?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  planet?: Resolver<Maybe<ResolversTypes['Planet']>, ParentType, ContextType>;
  position?: Resolver<Maybe<ResolversTypes['Position']>, ParentType, ContextType>;
  solarSystem?: Resolver<Maybe<ResolversTypes['SolarSystem']>, ParentType, ContextType>;
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

export type CampaignParticipantResolvers<ContextType = any, ParentType extends ResolversParentTypes['CampaignParticipant'] = ResolversParentTypes['CampaignParticipant']> = {
  allianceId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  allianceName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  allianceTicker?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  score?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export type CategoriesResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['CategoriesResponse'] = ResolversParentTypes['CategoriesResponse']> = {
  items?: Resolver<Array<ResolversTypes['Category']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type CategoryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Category'] = ResolversParentTypes['Category']> = {
  created_at?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  groups?: Resolver<Array<ResolversTypes['ItemGroup']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  published?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  updated_at?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
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
  securityStatus?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type CharacterTopTargetResolvers<ContextType = any, ParentType extends ResolversParentTypes['CharacterTopTarget'] = ResolversParentTypes['CharacterTopTarget']> = {
  character?: Resolver<ResolversTypes['Character'], ParentType, ContextType>;
  killCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type CharactersResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['CharactersResponse'] = ResolversParentTypes['CharactersResponse']> = {
  items?: Resolver<Array<ResolversTypes['Character']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type ConflictHotspotResolvers<ContextType = any, ParentType extends ResolversParentTypes['ConflictHotspot'] = ResolversParentTypes['ConflictHotspot']> = {
  activeCampaigns?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  intensityScore?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  iskDestroyed?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  regionId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  regionName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  warKills?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type ConstellationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Constellation'] = ResolversParentTypes['Constellation']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  position?: Resolver<Maybe<ResolversTypes['Position']>, ParentType, ContextType>;
  region?: Resolver<Maybe<ResolversTypes['Region']>, ParentType, ContextType>;
  solarSystemCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  solarSystems?: Resolver<Array<ResolversTypes['SolarSystem']>, ParentType, ContextType>;
  sovereignty?: Resolver<Maybe<ResolversTypes['SovereigntyHolder']>, ParentType, ContextType>;
};

export type ConstellationsResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['ConstellationsResponse'] = ResolversParentTypes['ConstellationsResponse']> = {
  items?: Resolver<Array<ResolversTypes['Constellation']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
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
  topAllianceTargets?: Resolver<Array<ResolversTypes['AllianceTopTarget']>, ParentType, ContextType, Partial<CorporationTopAllianceTargetsArgs>>;
  topCorporationTargets?: Resolver<Array<ResolversTypes['CorporationTopTarget']>, ParentType, ContextType, Partial<CorporationTopCorporationTargetsArgs>>;
  topShipTargets?: Resolver<Array<ResolversTypes['ShipTopKill']>, ParentType, ContextType, Partial<CorporationTopShipTargetsArgs>>;
  url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
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

export type CorporationTopTargetResolvers<ContextType = any, ParentType extends ResolversParentTypes['CorporationTopTarget'] = ResolversParentTypes['CorporationTopTarget']> = {
  corporation?: Resolver<ResolversTypes['Corporation'], ParentType, ContextType>;
  killCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type CorporationsResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['CorporationsResponse'] = ResolversParentTypes['CorporationsResponse']> = {
  items?: Resolver<Array<ResolversTypes['Corporation']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
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

export type DogmaAttributesResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['DogmaAttributesResponse'] = ResolversParentTypes['DogmaAttributesResponse']> = {
  items?: Resolver<Array<ResolversTypes['DogmaAttribute']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
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

export type DogmaEffectsResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['DogmaEffectsResponse'] = ResolversParentTypes['DogmaEffectsResponse']> = {
  items?: Resolver<Array<ResolversTypes['DogmaEffect']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type FactionResolvers<ContextType = any, ParentType extends ResolversParentTypes['Faction'] = ResolversParentTypes['Faction']> = {
  corporation?: Resolver<Maybe<ResolversTypes['Corporation']>, ParentType, ContextType>;
  corporationId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  memberCharacterCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  memberCorporationCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  militiaCorporation?: Resolver<Maybe<ResolversTypes['Corporation']>, ParentType, ContextType>;
  militiaCorporationId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  solarSystem?: Resolver<Maybe<ResolversTypes['SolarSystem']>, ParentType, ContextType>;
  sovereigntySystemCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  stationCount?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  stationSystemCount?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
};

export type FactionTopTargetResolvers<ContextType = any, ParentType extends ResolversParentTypes['FactionTopTarget'] = ResolversParentTypes['FactionTopTarget']> = {
  faction?: Resolver<ResolversTypes['Faction'], ParentType, ContextType>;
  killCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type FittingResolvers<ContextType = any, ParentType extends ResolversParentTypes['Fitting'] = ResolversParentTypes['Fitting']> = {
  cargo?: Resolver<Array<ResolversTypes['FittingModule']>, ParentType, ContextType>;
  coreRoom?: Resolver<Array<ResolversTypes['FittingModule']>, ParentType, ContextType>;
  droneBay?: Resolver<Array<ResolversTypes['FittingModule']>, ParentType, ContextType>;
  fighterBay?: Resolver<Array<ResolversTypes['FittingModule']>, ParentType, ContextType>;
  fleetHangar?: Resolver<Array<ResolversTypes['FittingModule']>, ParentType, ContextType>;
  fuelBay?: Resolver<Array<ResolversTypes['FittingModule']>, ParentType, ContextType>;
  gasHold?: Resolver<Array<ResolversTypes['FittingModule']>, ParentType, ContextType>;
  highSlots?: Resolver<ResolversTypes['SlotGroup'], ParentType, ContextType>;
  iceHold?: Resolver<Array<ResolversTypes['FittingModule']>, ParentType, ContextType>;
  implants?: Resolver<ResolversTypes['SlotGroup'], ParentType, ContextType>;
  infrastructureHangar?: Resolver<Array<ResolversTypes['FittingModule']>, ParentType, ContextType>;
  infrastructureHold?: Resolver<Array<ResolversTypes['FittingModule']>, ParentType, ContextType>;
  lowSlots?: Resolver<ResolversTypes['SlotGroup'], ParentType, ContextType>;
  midSlots?: Resolver<ResolversTypes['SlotGroup'], ParentType, ContextType>;
  mineralHold?: Resolver<Array<ResolversTypes['FittingModule']>, ParentType, ContextType>;
  oreHold?: Resolver<Array<ResolversTypes['FittingModule']>, ParentType, ContextType>;
  planetaryCommoditiesHold?: Resolver<Array<ResolversTypes['FittingModule']>, ParentType, ContextType>;
  rigs?: Resolver<ResolversTypes['SlotGroup'], ParentType, ContextType>;
  salvageHold?: Resolver<Array<ResolversTypes['FittingModule']>, ParentType, ContextType>;
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

export type ItemGroupsResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['ItemGroupsResponse'] = ResolversParentTypes['ItemGroupsResponse']> = {
  items?: Resolver<Array<ResolversTypes['ItemGroup']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
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
  isWarRelated?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  items?: Resolver<Array<ResolversTypes['KillmailItem']>, ParentType, ContextType>;
  killmailHash?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  killmailTime?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  location?: Resolver<Maybe<ResolversTypes['KillmailLocation']>, ParentType, ContextType>;
  npc?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  solarSystem?: Resolver<ResolversTypes['SolarSystem'], ParentType, ContextType>;
  solo?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  totalValue?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  victim?: Resolver<Maybe<ResolversTypes['Victim']>, ParentType, ContextType>;
};

export type KillmailDateCountResolvers<ContextType = any, ParentType extends ResolversParentTypes['KillmailDateCount'] = ResolversParentTypes['KillmailDateCount']> = {
  count?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  date?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type KillmailItemResolvers<ContextType = any, ParentType extends ResolversParentTypes['KillmailItem'] = ResolversParentTypes['KillmailItem']> = {
  charge?: Resolver<Maybe<ResolversTypes['KillmailItem']>, ParentType, ContextType>;
  flag?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  itemType?: Resolver<ResolversTypes['Type'], ParentType, ContextType>;
  quantityDestroyed?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  quantityDropped?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  singleton?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type KillmailLocationResolvers<ContextType = any, ParentType extends ResolversParentTypes['KillmailLocation'] = ResolversParentTypes['KillmailLocation']> = {
  distance?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  kind?: Resolver<ResolversTypes['MapCelestialKind'], ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type KillmailsResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['KillmailsResponse'] = ResolversParentTypes['KillmailsResponse']> = {
  items?: Resolver<Array<ResolversTypes['Killmail']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type MapBoundsResolvers<ContextType = any, ParentType extends ResolversParentTypes['MapBounds'] = ResolversParentTypes['MapBounds']> = {
  maxX?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  maxZ?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  minX?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  minZ?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export type MapCelestialResolvers<ContextType = any, ParentType extends ResolversParentTypes['MapCelestial'] = ResolversParentTypes['MapCelestial']> = {
  destinationSystemId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  kind?: Resolver<ResolversTypes['MapCelestialKind'], ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  orbitIndex?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  planetId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  systemId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  x?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  z?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export type MapEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['MapEdge'] = ResolversParentTypes['MapEdge']> = {
  from?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  to?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type MapGeometryResolvers<ContextType = any, ParentType extends ResolversParentTypes['MapGeometry'] = ResolversParentTypes['MapGeometry']> = {
  bounds?: Resolver<ResolversTypes['MapBounds'], ParentType, ContextType>;
  edges?: Resolver<Array<ResolversTypes['MapEdge']>, ParentType, ContextType>;
  nodes?: Resolver<Array<ResolversTypes['MapNode']>, ParentType, ContextType>;
  scope?: Resolver<ResolversTypes['MapScope'], ParentType, ContextType>;
};

export type MapLabelResolvers<ContextType = any, ParentType extends ResolversParentTypes['MapLabel'] = ResolversParentTypes['MapLabel']> = {
  bounds?: Resolver<Maybe<ResolversTypes['MapBounds']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  kind?: Resolver<ResolversTypes['MapLabelKind'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  systemId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  x?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  z?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export type MapNodeResolvers<ContextType = any, ParentType extends ResolversParentTypes['MapNode'] = ResolversParentTypes['MapNode']> = {
  constellationId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  radius?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  regionId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  securityStatus?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  systemId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  x?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  z?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export type MapSovOwnerResolvers<ContextType = any, ParentType extends ResolversParentTypes['MapSovOwner'] = ResolversParentTypes['MapSovOwner']> = {
  kind?: Resolver<ResolversTypes['MapOwnerKind'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  systemCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  ticker?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type MapSovSystemResolvers<ContextType = any, ParentType extends ResolversParentTypes['MapSovSystem'] = ResolversParentTypes['MapSovSystem']> = {
  ownerId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  systemId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type MapSovereigntyResolvers<ContextType = any, ParentType extends ResolversParentTypes['MapSovereignty'] = ResolversParentTypes['MapSovereignty']> = {
  owners?: Resolver<Array<ResolversTypes['MapSovOwner']>, ParentType, ContextType>;
  scope?: Resolver<ResolversTypes['MapScope'], ParentType, ContextType>;
  systems?: Resolver<Array<ResolversTypes['MapSovSystem']>, ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type MapSystemDetailsResolvers<ContextType = any, ParentType extends ResolversParentTypes['MapSystemDetails'] = ResolversParentTypes['MapSystemDetails']> = {
  constellationName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  npcKills?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  owner?: Resolver<Maybe<ResolversTypes['MapSystemOwner']>, ParentType, ContextType>;
  podKills?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  regionName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  securityStatus?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  shipJumps?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  shipKills?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  snapshotAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  stargates?: Resolver<Array<ResolversTypes['MapSystemStargate']>, ParentType, ContextType>;
  systemId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type MapSystemOwnerResolvers<ContextType = any, ParentType extends ResolversParentTypes['MapSystemOwner'] = ResolversParentTypes['MapSystemOwner']> = {
  kind?: Resolver<ResolversTypes['MapOwnerKind'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ownerId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  ticker?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type MapSystemStargateResolvers<ContextType = any, ParentType extends ResolversParentTypes['MapSystemStargate'] = ResolversParentTypes['MapSystemStargate']> = {
  destinationName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  destinationSecurityStatus?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  destinationSystemId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  stargateId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type MoonResolvers<ContextType = any, ParentType extends ResolversParentTypes['Moon'] = ResolversParentTypes['Moon']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  orbitIndex?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  planet?: Resolver<Maybe<ResolversTypes['Planet']>, ParentType, ContextType>;
  position?: Resolver<Maybe<ResolversTypes['Position']>, ParentType, ContextType>;
  solarSystem?: Resolver<Maybe<ResolversTypes['SolarSystem']>, ParentType, ContextType>;
};

export type MutationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  _empty?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  clearAllKillmailCaches?: Resolver<ResolversTypes['CacheOperation'], ParentType, ContextType>;
  clearAllianceCache?: Resolver<ResolversTypes['CacheOperation'], ParentType, ContextType, RequireFields<MutationClearAllianceCacheArgs, 'allianceId'>>;
  clearCharacterCache?: Resolver<ResolversTypes['CacheOperation'], ParentType, ContextType, RequireFields<MutationClearCharacterCacheArgs, 'characterId'>>;
  clearCorporationCache?: Resolver<ResolversTypes['CacheOperation'], ParentType, ContextType, RequireFields<MutationClearCorporationCacheArgs, 'corporationId'>>;
  clearKillmailCache?: Resolver<ResolversTypes['CacheOperation'], ParentType, ContextType, RequireFields<MutationClearKillmailCacheArgs, 'killmailId'>>;
  createUser?: Resolver<ResolversTypes['CreateUserPayload'], ParentType, ContextType, RequireFields<MutationCreateUserArgs, 'input'>>;
  login?: Resolver<ResolversTypes['AuthUrl'], ParentType, ContextType, Partial<MutationLoginArgs>>;
  logout?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  refreshCharacter?: Resolver<ResolversTypes['RefreshCharacterResult'], ParentType, ContextType, RequireFields<MutationRefreshCharacterArgs, 'characterId'>>;
  refreshSession?: Resolver<ResolversTypes['AuthPayload'], ParentType, ContextType>;
  revokeSession?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationRevokeSessionArgs, 'id'>>;
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
  totalCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalPages?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type PlanetResolvers<ContextType = any, ParentType extends ResolversParentTypes['Planet'] = ResolversParentTypes['Planet']> = {
  asteroidBelts?: Resolver<Array<ResolversTypes['AsteroidBelt']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  moons?: Resolver<Array<ResolversTypes['Moon']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  orbitIndex?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  position?: Resolver<Maybe<ResolversTypes['Position']>, ParentType, ContextType>;
  solarSystem?: Resolver<Maybe<ResolversTypes['SolarSystem']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['Type']>, ParentType, ContextType>;
  typeId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
};

export type PositionResolvers<ContextType = any, ParentType extends ResolversParentTypes['Position'] = ResolversParentTypes['Position']> = {
  x?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  y?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  z?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  _empty?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  activeCampaignsByRegion?: Resolver<Array<ResolversTypes['RegionCampaignCount']>, ParentType, ContextType, Partial<QueryActiveCampaignsByRegionArgs>>;
  activeUsersCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  alliance?: Resolver<Maybe<ResolversTypes['Alliance']>, ParentType, ContextType, RequireFields<QueryAllianceArgs, 'id'>>;
  allianceTerritoryRankings?: Resolver<Array<ResolversTypes['AllianceTerritoryRank']>, ParentType, ContextType, Partial<QueryAllianceTerritoryRankingsArgs>>;
  allianceTopAllianceTargets?: Resolver<Array<ResolversTypes['AllianceTopTarget']>, ParentType, ContextType, RequireFields<QueryAllianceTopAllianceTargetsArgs, 'allianceId'>>;
  allianceTopCharacters?: Resolver<Array<ResolversTypes['CharacterTopTarget']>, ParentType, ContextType, RequireFields<QueryAllianceTopCharactersArgs, 'allianceId'>>;
  allianceTopCorporationTargets?: Resolver<Array<ResolversTypes['CorporationTopTarget']>, ParentType, ContextType, RequireFields<QueryAllianceTopCorporationTargetsArgs, 'allianceId'>>;
  allianceTopShipTargets?: Resolver<Array<ResolversTypes['ShipTopKill']>, ParentType, ContextType, RequireFields<QueryAllianceTopShipTargetsArgs, 'allianceId'>>;
  allianceTopShips?: Resolver<Array<ResolversTypes['ShipTopKill']>, ParentType, ContextType, RequireFields<QueryAllianceTopShipsArgs, 'allianceId'>>;
  alliances?: Resolver<ResolversTypes['AlliancesResponse'], ParentType, ContextType, Partial<QueryAlliancesArgs>>;
  bloodline?: Resolver<Maybe<ResolversTypes['Bloodline']>, ParentType, ContextType, RequireFields<QueryBloodlineArgs, 'id'>>;
  bloodlines?: Resolver<Array<ResolversTypes['Bloodline']>, ParentType, ContextType>;
  cacheStats?: Resolver<ResolversTypes['CacheStats'], ParentType, ContextType>;
  categories?: Resolver<ResolversTypes['CategoriesResponse'], ParentType, ContextType, Partial<QueryCategoriesArgs>>;
  category?: Resolver<Maybe<ResolversTypes['Category']>, ParentType, ContextType, RequireFields<QueryCategoryArgs, 'id'>>;
  character?: Resolver<Maybe<ResolversTypes['Character']>, ParentType, ContextType, RequireFields<QueryCharacterArgs, 'id'>>;
  characterTopAllianceTargets?: Resolver<Array<ResolversTypes['AllianceTopTarget']>, ParentType, ContextType, RequireFields<QueryCharacterTopAllianceTargetsArgs, 'characterId'>>;
  characterTopCorporationTargets?: Resolver<Array<ResolversTypes['CorporationTopTarget']>, ParentType, ContextType, RequireFields<QueryCharacterTopCorporationTargetsArgs, 'characterId'>>;
  characterTopShipTargets?: Resolver<Array<ResolversTypes['ShipTopKill']>, ParentType, ContextType, RequireFields<QueryCharacterTopShipTargetsArgs, 'characterId'>>;
  characterTopShips?: Resolver<Array<ResolversTypes['ShipTopKill']>, ParentType, ContextType, RequireFields<QueryCharacterTopShipsArgs, 'characterId'>>;
  characters?: Resolver<ResolversTypes['CharactersResponse'], ParentType, ContextType, Partial<QueryCharactersArgs>>;
  conflictHotspots?: Resolver<Array<ResolversTypes['ConflictHotspot']>, ParentType, ContextType, Partial<QueryConflictHotspotsArgs>>;
  constellation?: Resolver<Maybe<ResolversTypes['Constellation']>, ParentType, ContextType, RequireFields<QueryConstellationArgs, 'id'>>;
  constellations?: Resolver<ResolversTypes['ConstellationsResponse'], ParentType, ContextType, Partial<QueryConstellationsArgs>>;
  corporation?: Resolver<Maybe<ResolversTypes['Corporation']>, ParentType, ContextType, RequireFields<QueryCorporationArgs, 'id'>>;
  corporationTopAllianceTargets?: Resolver<Array<ResolversTypes['AllianceTopTarget']>, ParentType, ContextType, RequireFields<QueryCorporationTopAllianceTargetsArgs, 'corporationId'>>;
  corporationTopCharacters?: Resolver<Array<ResolversTypes['CharacterTopTarget']>, ParentType, ContextType, RequireFields<QueryCorporationTopCharactersArgs, 'corporationId'>>;
  corporationTopCorporationTargets?: Resolver<Array<ResolversTypes['CorporationTopTarget']>, ParentType, ContextType, RequireFields<QueryCorporationTopCorporationTargetsArgs, 'corporationId'>>;
  corporationTopShipTargets?: Resolver<Array<ResolversTypes['ShipTopKill']>, ParentType, ContextType, RequireFields<QueryCorporationTopShipTargetsArgs, 'corporationId'>>;
  corporationTopShips?: Resolver<Array<ResolversTypes['ShipTopKill']>, ParentType, ContextType, RequireFields<QueryCorporationTopShipsArgs, 'corporationId'>>;
  corporations?: Resolver<ResolversTypes['CorporationsResponse'], ParentType, ContextType, Partial<QueryCorporationsArgs>>;
  dogmaAttribute?: Resolver<Maybe<ResolversTypes['DogmaAttribute']>, ParentType, ContextType, RequireFields<QueryDogmaAttributeArgs, 'id'>>;
  dogmaAttributes?: Resolver<ResolversTypes['DogmaAttributesResponse'], ParentType, ContextType, Partial<QueryDogmaAttributesArgs>>;
  dogmaEffect?: Resolver<Maybe<ResolversTypes['DogmaEffect']>, ParentType, ContextType, RequireFields<QueryDogmaEffectArgs, 'id'>>;
  dogmaEffects?: Resolver<ResolversTypes['DogmaEffectsResponse'], ParentType, ContextType, Partial<QueryDogmaEffectsArgs>>;
  faction?: Resolver<Maybe<ResolversTypes['Faction']>, ParentType, ContextType, RequireFields<QueryFactionArgs, 'id'>>;
  factionTopCharacters?: Resolver<Array<ResolversTypes['CharacterTopTarget']>, ParentType, ContextType, RequireFields<QueryFactionTopCharactersArgs, 'factionId'>>;
  factionTopCorporations?: Resolver<Array<ResolversTypes['CorporationTopTarget']>, ParentType, ContextType, RequireFields<QueryFactionTopCorporationsArgs, 'factionId'>>;
  factionTopFactionTargets?: Resolver<Array<ResolversTypes['FactionTopTarget']>, ParentType, ContextType, RequireFields<QueryFactionTopFactionTargetsArgs, 'factionId'>>;
  factionTopShipTargets?: Resolver<Array<ResolversTypes['ShipTopKill']>, ParentType, ContextType, RequireFields<QueryFactionTopShipTargetsArgs, 'factionId'>>;
  factionTopShips?: Resolver<Array<ResolversTypes['ShipTopKill']>, ParentType, ContextType, RequireFields<QueryFactionTopShipsArgs, 'factionId'>>;
  factions?: Resolver<Array<ResolversTypes['Faction']>, ParentType, ContextType>;
  itemGroup?: Resolver<Maybe<ResolversTypes['ItemGroup']>, ParentType, ContextType, RequireFields<QueryItemGroupArgs, 'id'>>;
  itemGroups?: Resolver<ResolversTypes['ItemGroupsResponse'], ParentType, ContextType, Partial<QueryItemGroupsArgs>>;
  killmail?: Resolver<Maybe<ResolversTypes['Killmail']>, ParentType, ContextType, RequireFields<QueryKillmailArgs, 'id'>>;
  killmails?: Resolver<ResolversTypes['KillmailsResponse'], ParentType, ContextType, Partial<QueryKillmailsArgs>>;
  killmailsDateCounts?: Resolver<Array<ResolversTypes['KillmailDateCount']>, ParentType, ContextType, Partial<QueryKillmailsDateCountsArgs>>;
  mapCelestials?: Resolver<Array<ResolversTypes['MapCelestial']>, ParentType, ContextType, RequireFields<QueryMapCelestialsArgs, 'systemIds'>>;
  mapGeometry?: Resolver<ResolversTypes['MapGeometry'], ParentType, ContextType, RequireFields<QueryMapGeometryArgs, 'scope'>>;
  mapLabels?: Resolver<Array<ResolversTypes['MapLabel']>, ParentType, ContextType, RequireFields<QueryMapLabelsArgs, 'kind' | 'scope'>>;
  mapSovereignty?: Resolver<ResolversTypes['MapSovereignty'], ParentType, ContextType, RequireFields<QueryMapSovereigntyArgs, 'scope'>>;
  mapSystemDetails?: Resolver<Maybe<ResolversTypes['MapSystemDetails']>, ParentType, ContextType, RequireFields<QueryMapSystemDetailsArgs, 'systemId'>>;
  me?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  mostAggressiveAlliances?: Resolver<Array<ResolversTypes['AllianceActivityRank']>, ParentType, ContextType, Partial<QueryMostAggressiveAlliancesArgs>>;
  mostDefensiveAlliances?: Resolver<Array<ResolversTypes['AllianceActivityRank']>, ParentType, ContextType, Partial<QueryMostDefensiveAlliancesArgs>>;
  mostValuableKillmails?: Resolver<Array<ResolversTypes['Killmail']>, ParentType, ContextType, RequireFields<QueryMostValuableKillmailsArgs, 'days' | 'limit' | 'scope'>>;
  mySessions?: Resolver<Array<ResolversTypes['Session']>, ParentType, ContextType>;
  race?: Resolver<Maybe<ResolversTypes['Race']>, ParentType, ContextType, RequireFields<QueryRaceArgs, 'id'>>;
  races?: Resolver<Array<ResolversTypes['Race']>, ParentType, ContextType>;
  recentTerritoryChanges?: Resolver<Array<ResolversTypes['TerritoryChange']>, ParentType, ContextType, Partial<QueryRecentTerritoryChangesArgs>>;
  region?: Resolver<Maybe<ResolversTypes['Region']>, ParentType, ContextType, RequireFields<QueryRegionArgs, 'id'>>;
  regions?: Resolver<ResolversTypes['RegionsResponse'], ParentType, ContextType, Partial<QueryRegionsArgs>>;
  solarSystem?: Resolver<Maybe<ResolversTypes['SolarSystem']>, ParentType, ContextType, RequireFields<QuerySolarSystemArgs, 'id'>>;
  solarSystemStats?: Resolver<ResolversTypes['SolarSystemStats'], ParentType, ContextType, RequireFields<QuerySolarSystemStatsArgs, 'systemId'>>;
  solarSystems?: Resolver<ResolversTypes['SolarSystemsResponse'], ParentType, ContextType, Partial<QuerySolarSystemsArgs>>;
  sovereigntyActiveCampaigns?: Resolver<Array<ResolversTypes['SovereigntyCampaign']>, ParentType, ContextType, Partial<QuerySovereigntyActiveCampaignsArgs>>;
  sovereigntyCampaignHistory?: Resolver<ResolversTypes['SovereigntyCampaignHistoryPage'], ParentType, ContextType, Partial<QuerySovereigntyCampaignHistoryArgs>>;
  sovereigntyOutcomeStats?: Resolver<ResolversTypes['SovereigntyOutcomeStats'], ParentType, ContextType>;
  sovereigntyOverview?: Resolver<ResolversTypes['SovereigntyOverview'], ParentType, ContextType>;
  sovereigntyStructures?: Resolver<Array<ResolversTypes['SovereigntyStructureInfo']>, ParentType, ContextType, Partial<QuerySovereigntyStructuresArgs>>;
  sovereigntyUpcomingTimers?: Resolver<Array<ResolversTypes['SovereigntyStructureInfo']>, ParentType, ContextType, Partial<QuerySovereigntyUpcomingTimersArgs>>;
  systemActivityHistory?: Resolver<Array<ResolversTypes['SystemActivity']>, ParentType, ContextType, RequireFields<QuerySystemActivityHistoryArgs, 'filter'>>;
  systemLatestActivity?: Resolver<Maybe<ResolversTypes['SystemActivity']>, ParentType, ContextType, RequireFields<QuerySystemLatestActivityArgs, 'system_id'>>;
  topActiveSystems?: Resolver<Array<ResolversTypes['SystemActivityStats']>, ParentType, ContextType, Partial<QueryTopActiveSystemsArgs>>;
  topAlliances?: Resolver<Array<ResolversTypes['TopAlliance']>, ParentType, ContextType, Partial<QueryTopAlliancesArgs>>;
  topAttackerShips?: Resolver<Array<ResolversTypes['TopShip']>, ParentType, ContextType, Partial<QueryTopAttackerShipsArgs>>;
  topCorporations?: Resolver<Array<ResolversTypes['TopCorporation']>, ParentType, ContextType, Partial<QueryTopCorporationsArgs>>;
  topDefenders?: Resolver<Array<ResolversTypes['AllianceDefenseRecord']>, ParentType, ContextType, Partial<QueryTopDefendersArgs>>;
  topDestroyedShips?: Resolver<Array<ResolversTypes['TopShip']>, ParentType, ContextType, Partial<QueryTopDestroyedShipsArgs>>;
  topFactions?: Resolver<Array<ResolversTypes['TopFaction']>, ParentType, ContextType, Partial<QueryTopFactionsArgs>>;
  topPilots?: Resolver<Array<ResolversTypes['TopPilot']>, ParentType, ContextType, Partial<QueryTopPilotsArgs>>;
  topRegions?: Resolver<Array<ResolversTypes['TopRegion']>, ParentType, ContextType, Partial<QueryTopRegionsArgs>>;
  topSystems?: Resolver<Array<ResolversTypes['TopSystem']>, ParentType, ContextType, Partial<QueryTopSystemsArgs>>;
  type?: Resolver<Maybe<ResolversTypes['Type']>, ParentType, ContextType, RequireFields<QueryTypeArgs, 'id'>>;
  types?: Resolver<ResolversTypes['TypesResponse'], ParentType, ContextType, Partial<QueryTypesArgs>>;
  user?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType, RequireFields<QueryUserArgs, 'id'>>;
  users?: Resolver<Array<ResolversTypes['User']>, ParentType, ContextType>;
  workerStatus?: Resolver<ResolversTypes['WorkerStatus'], ParentType, ContextType>;
};

export type QueueStatusResolvers<ContextType = any, ParentType extends ResolversParentTypes['QueueStatus'] = ResolversParentTypes['QueueStatus']> = {
  active?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  consumerCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  health?: Resolver<ResolversTypes['QueueHealth'], ParentType, ContextType>;
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

export type RedisMetricsResolvers<ContextType = any, ParentType extends ResolversParentTypes['RedisMetrics'] = ResolversParentTypes['RedisMetrics']> = {
  commandsPerSecond?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  connected?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  connectedClients?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  memoryUsage?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  totalCommandsProcessed?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalKeys?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  uptimeInSeconds?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
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
  solarSystemCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  sovereignty?: Resolver<Maybe<ResolversTypes['SovereigntyHolder']>, ParentType, ContextType>;
};

export type RegionCampaignCountResolvers<ContextType = any, ParentType extends ResolversParentTypes['RegionCampaignCount'] = ResolversParentTypes['RegionCampaignCount']> = {
  campaignCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  regionId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  regionName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type RegionsResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['RegionsResponse'] = ResolversParentTypes['RegionsResponse']> = {
  items?: Resolver<Array<ResolversTypes['Region']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type SessionResolvers<ContextType = any, ParentType extends ResolversParentTypes['Session'] = ResolversParentTypes['Session']> = {
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  current?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  expiresAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  ip?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  lastSeenAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  userAgent?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type ShipTopKillResolvers<ContextType = any, ParentType extends ResolversParentTypes['ShipTopKill'] = ResolversParentTypes['ShipTopKill']> = {
  killCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  shipType?: Resolver<ResolversTypes['Type'], ParentType, ContextType>;
};

export type SlotGroupResolvers<ContextType = any, ParentType extends ResolversParentTypes['SlotGroup'] = ResolversParentTypes['SlotGroup']> = {
  slots?: Resolver<Array<ResolversTypes['FittingSlot']>, ParentType, ContextType>;
  totalSlots?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type SolarSystemResolvers<ContextType = any, ParentType extends ResolversParentTypes['SolarSystem'] = ResolversParentTypes['SolarSystem']> = {
  constellation?: Resolver<Maybe<ResolversTypes['Constellation']>, ParentType, ContextType>;
  counts?: Resolver<ResolversTypes['SolarSystemCounts'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  latestActivity?: Resolver<Maybe<ResolversTypes['SystemActivity']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  planets?: Resolver<Array<ResolversTypes['Planet']>, ParentType, ContextType>;
  position?: Resolver<Maybe<ResolversTypes['Position']>, ParentType, ContextType>;
  securityStatus?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  security_class?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  star?: Resolver<Maybe<ResolversTypes['Star']>, ParentType, ContextType>;
  star_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  stargates?: Resolver<Array<ResolversTypes['Stargate']>, ParentType, ContextType>;
  stations?: Resolver<Array<ResolversTypes['Station']>, ParentType, ContextType>;
};

export type SolarSystemCountsResolvers<ContextType = any, ParentType extends ResolversParentTypes['SolarSystemCounts'] = ResolversParentTypes['SolarSystemCounts']> = {
  asteroidBelts?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  moons?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  planets?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  sovereigntyStructures?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  stargates?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  stations?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type SolarSystemStatsResolvers<ContextType = any, ParentType extends ResolversParentTypes['SolarSystemStats'] = ResolversParentTypes['SolarSystemStats']> = {
  busiestHourUtc?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  iskDestroyed7d?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  kills7d?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  kills24h?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  lastKillTime?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  systemId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalIskDestroyed?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalKills?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type SolarSystemsResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['SolarSystemsResponse'] = ResolversParentTypes['SolarSystemsResponse']> = {
  items?: Resolver<Array<ResolversTypes['SolarSystem']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type SovereigntyAlertResolvers<ContextType = any, ParentType extends ResolversParentTypes['SovereigntyAlert'] = ResolversParentTypes['SovereigntyAlert']> = {
  allianceId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  allianceName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  allianceTicker?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  changeType?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  outcome?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  regionName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  solarSystemId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  solarSystemName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  timestamp?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type SovereigntyCampaignResolvers<ContextType = any, ParentType extends ResolversParentTypes['SovereigntyCampaign'] = ResolversParentTypes['SovereigntyCampaign']> = {
  attackerIskLost?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  attackerShipsLost?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  attackersScore?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  campaignId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  constellationId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  defenderId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  defenderIskLost?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  defenderName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  defenderScore?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  defenderShipsLost?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  defenderTicker?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  durationHours?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  endTime?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  eventType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  iskDestroyed?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  outcome?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  participants?: Resolver<Array<ResolversTypes['CampaignParticipant']>, ParentType, ContextType>;
  regionId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  regionName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  solarSystemId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  solarSystemName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  startTime?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  structureId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  warKills?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type SovereigntyCampaignHistoryPageResolvers<ContextType = any, ParentType extends ResolversParentTypes['SovereigntyCampaignHistoryPage'] = ResolversParentTypes['SovereigntyCampaignHistoryPage']> = {
  items?: Resolver<Array<ResolversTypes['SovereigntyCampaign']>, ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type SovereigntyHolderResolvers<ContextType = any, ParentType extends ResolversParentTypes['SovereigntyHolder'] = ResolversParentTypes['SovereigntyHolder']> = {
  allianceTicker?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  ownerId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  ownerName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  ownerType?: Resolver<ResolversTypes['SovereigntyOwnerType'], ParentType, ContextType>;
  systemCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type SovereigntyOutcomeStatsResolvers<ContextType = any, ParentType extends ResolversParentTypes['SovereigntyOutcomeStats'] = ResolversParentTypes['SovereigntyOutcomeStats']> = {
  abandoned?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  attackerWon?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  defenderWon?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalResolved?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type SovereigntyOverviewResolvers<ContextType = any, ParentType extends ResolversParentTypes['SovereigntyOverview'] = ResolversParentTypes['SovereigntyOverview']> = {
  activeCampaigns?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  iskDestroyed?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  ownedSystems?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  trackedAlliances?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  trackedStructures?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  warKills?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type SovereigntyStructureInfoResolvers<ContextType = any, ParentType extends ResolversParentTypes['SovereigntyStructureInfo'] = ResolversParentTypes['SovereigntyStructureInfo']> = {
  allianceId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  allianceName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  allianceTicker?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  firstSeen?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  lastSeen?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  occupancyLevel?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  regionId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  regionName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  solarSystemId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  solarSystemName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  structureId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  structureTypeId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  structureTypeName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  vulnerableEndTime?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  vulnerableStartTime?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type StandaloneWorkerStatusResolvers<ContextType = any, ParentType extends ResolversParentTypes['StandaloneWorkerStatus'] = ResolversParentTypes['StandaloneWorkerStatus']> = {
  description?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  pid?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  running?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type StarResolvers<ContextType = any, ParentType extends ResolversParentTypes['Star'] = ResolversParentTypes['Star']> = {
  age?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  luminosity?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  radius?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  solarSystem?: Resolver<Maybe<ResolversTypes['SolarSystem']>, ParentType, ContextType>;
  spectralClass?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  temperature?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['Type']>, ParentType, ContextType>;
  typeId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
};

export type StargateResolvers<ContextType = any, ParentType extends ResolversParentTypes['Stargate'] = ResolversParentTypes['Stargate']> = {
  destination?: Resolver<Maybe<ResolversTypes['StargateDestination']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  position?: Resolver<Maybe<ResolversTypes['Position']>, ParentType, ContextType>;
  solarSystem?: Resolver<Maybe<ResolversTypes['SolarSystem']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['Type']>, ParentType, ContextType>;
  typeId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
};

export type StargateDestinationResolvers<ContextType = any, ParentType extends ResolversParentTypes['StargateDestination'] = ResolversParentTypes['StargateDestination']> = {
  destinationStargateId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  destinationSystemId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  stargate?: Resolver<Maybe<ResolversTypes['Stargate']>, ParentType, ContextType>;
  system?: Resolver<Maybe<ResolversTypes['SolarSystem']>, ParentType, ContextType>;
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

export type StationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Station'] = ResolversParentTypes['Station']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  maxDockableShipVolume?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  officeRentalCost?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  ownerCorporation?: Resolver<Maybe<ResolversTypes['Corporation']>, ParentType, ContextType>;
  ownerCorporationId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  position?: Resolver<Maybe<ResolversTypes['Position']>, ParentType, ContextType>;
  raceId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  reprocessingEfficiency?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  reprocessingStationsTake?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  services?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  solarSystem?: Resolver<Maybe<ResolversTypes['SolarSystem']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['Type']>, ParentType, ContextType>;
  typeId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
};

export type SubscriptionResolvers<ContextType = any, ParentType extends ResolversParentTypes['Subscription'] = ResolversParentTypes['Subscription']> = {
  _empty?: SubscriptionResolver<Maybe<ResolversTypes['String']>, "_empty", ParentType, ContextType>;
  activeUsersUpdates?: SubscriptionResolver<ResolversTypes['ActiveUsersPayload'], "activeUsersUpdates", ParentType, ContextType>;
  newKillmail?: SubscriptionResolver<ResolversTypes['Killmail'], "newKillmail", ParentType, ContextType>;
  sovereigntyAlert?: SubscriptionResolver<ResolversTypes['SovereigntyAlert'], "sovereigntyAlert", ParentType, ContextType>;
  workerStatusUpdates?: SubscriptionResolver<ResolversTypes['WorkerStatus'], "workerStatusUpdates", ParentType, ContextType>;
};

export type SyncMyKillmailsPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['SyncMyKillmailsPayload'] = ResolversParentTypes['SyncMyKillmailsPayload']> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  syncedCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type SystemActivityResolvers<ContextType = any, ParentType extends ResolversParentTypes['SystemActivity'] = ResolversParentTypes['SystemActivity']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  npc_kills?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  pod_kills?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  ship_jumps?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  ship_kills?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  solar_system?: Resolver<Maybe<ResolversTypes['SolarSystem']>, ParentType, ContextType>;
  system_id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  timestamp?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type SystemActivityStatsResolvers<ContextType = any, ParentType extends ResolversParentTypes['SystemActivityStats'] = ResolversParentTypes['SystemActivityStats']> = {
  latest_npc_kills?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  latest_pod_kills?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  latest_ship_kills?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  latest_timestamp?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  system_id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  system_name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  total_kills?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type TerritoryChangeResolvers<ContextType = any, ParentType extends ResolversParentTypes['TerritoryChange'] = ResolversParentTypes['TerritoryChange']> = {
  changeType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  detectedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  newOwnerId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  newOwnerName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  previousOwnerId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  previousOwnerName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  solarSystemId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  solarSystemName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type TopAllianceResolvers<ContextType = any, ParentType extends ResolversParentTypes['TopAlliance'] = ResolversParentTypes['TopAlliance']> = {
  alliance?: Resolver<Maybe<ResolversTypes['Alliance']>, ParentType, ContextType>;
  killCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  rank?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type TopCorporationResolvers<ContextType = any, ParentType extends ResolversParentTypes['TopCorporation'] = ResolversParentTypes['TopCorporation']> = {
  corporation?: Resolver<Maybe<ResolversTypes['Corporation']>, ParentType, ContextType>;
  killCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  rank?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type TopFactionResolvers<ContextType = any, ParentType extends ResolversParentTypes['TopFaction'] = ResolversParentTypes['TopFaction']> = {
  faction?: Resolver<Maybe<ResolversTypes['Faction']>, ParentType, ContextType>;
  killCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  rank?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type TopPilotResolvers<ContextType = any, ParentType extends ResolversParentTypes['TopPilot'] = ResolversParentTypes['TopPilot']> = {
  character?: Resolver<Maybe<ResolversTypes['Character']>, ParentType, ContextType>;
  killCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  rank?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type TopRegionResolvers<ContextType = any, ParentType extends ResolversParentTypes['TopRegion'] = ResolversParentTypes['TopRegion']> = {
  killCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  rank?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  region?: Resolver<Maybe<ResolversTypes['Region']>, ParentType, ContextType>;
};

export type TopShipResolvers<ContextType = any, ParentType extends ResolversParentTypes['TopShip'] = ResolversParentTypes['TopShip']> = {
  killCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  rank?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  shipType?: Resolver<Maybe<ResolversTypes['Type']>, ParentType, ContextType>;
};

export type TopSystemResolvers<ContextType = any, ParentType extends ResolversParentTypes['TopSystem'] = ResolversParentTypes['TopSystem']> = {
  killCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  rank?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  solarSystem?: Resolver<Maybe<ResolversTypes['SolarSystem']>, ParentType, ContextType>;
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
  metaGroupId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  published?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  updated_at?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  volume?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
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

export type TypesResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['TypesResponse'] = ResolversParentTypes['TypesResponse']> = {
  items?: Resolver<Array<ResolversTypes['Type']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
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
  redis?: Resolver<Maybe<ResolversTypes['RedisMetrics']>, ParentType, ContextType>;
  standaloneWorkers?: Resolver<Array<ResolversTypes['StandaloneWorkerStatus']>, ParentType, ContextType>;
  timestamp?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type Resolvers<ContextType = any> = {
  ActiveUsersPayload?: ActiveUsersPayloadResolvers<ContextType>;
  Alliance?: AllianceResolvers<ContextType>;
  AllianceActivityRank?: AllianceActivityRankResolvers<ContextType>;
  AllianceDefenseRecord?: AllianceDefenseRecordResolvers<ContextType>;
  AllianceMetrics?: AllianceMetricsResolvers<ContextType>;
  AllianceSnapshot?: AllianceSnapshotResolvers<ContextType>;
  AllianceTerritoryRank?: AllianceTerritoryRankResolvers<ContextType>;
  AllianceTopTarget?: AllianceTopTargetResolvers<ContextType>;
  AlliancesResponse?: AlliancesResponseResolvers<ContextType>;
  AsteroidBelt?: AsteroidBeltResolvers<ContextType>;
  Attacker?: AttackerResolvers<ContextType>;
  AuthPayload?: AuthPayloadResolvers<ContextType>;
  AuthUrl?: AuthUrlResolvers<ContextType>;
  Bloodline?: BloodlineResolvers<ContextType>;
  CacheOperation?: CacheOperationResolvers<ContextType>;
  CacheStats?: CacheStatsResolvers<ContextType>;
  CampaignParticipant?: CampaignParticipantResolvers<ContextType>;
  CategoriesResponse?: CategoriesResponseResolvers<ContextType>;
  Category?: CategoryResolvers<ContextType>;
  Character?: CharacterResolvers<ContextType>;
  CharacterTopTarget?: CharacterTopTargetResolvers<ContextType>;
  CharactersResponse?: CharactersResponseResolvers<ContextType>;
  ConflictHotspot?: ConflictHotspotResolvers<ContextType>;
  Constellation?: ConstellationResolvers<ContextType>;
  ConstellationsResponse?: ConstellationsResponseResolvers<ContextType>;
  Corporation?: CorporationResolvers<ContextType>;
  CorporationMetrics?: CorporationMetricsResolvers<ContextType>;
  CorporationSnapshot?: CorporationSnapshotResolvers<ContextType>;
  CorporationTopTarget?: CorporationTopTargetResolvers<ContextType>;
  CorporationsResponse?: CorporationsResponseResolvers<ContextType>;
  CreateUserPayload?: CreateUserPayloadResolvers<ContextType>;
  DogmaAttribute?: DogmaAttributeResolvers<ContextType>;
  DogmaAttributesResponse?: DogmaAttributesResponseResolvers<ContextType>;
  DogmaEffect?: DogmaEffectResolvers<ContextType>;
  DogmaEffectsResponse?: DogmaEffectsResponseResolvers<ContextType>;
  Faction?: FactionResolvers<ContextType>;
  FactionTopTarget?: FactionTopTargetResolvers<ContextType>;
  Fitting?: FittingResolvers<ContextType>;
  FittingModule?: FittingModuleResolvers<ContextType>;
  FittingSlot?: FittingSlotResolvers<ContextType>;
  ItemGroup?: ItemGroupResolvers<ContextType>;
  ItemGroupsResponse?: ItemGroupsResponseResolvers<ContextType>;
  JitaPrice?: JitaPriceResolvers<ContextType>;
  Killmail?: KillmailResolvers<ContextType>;
  KillmailDateCount?: KillmailDateCountResolvers<ContextType>;
  KillmailItem?: KillmailItemResolvers<ContextType>;
  KillmailLocation?: KillmailLocationResolvers<ContextType>;
  KillmailsResponse?: KillmailsResponseResolvers<ContextType>;
  MapBounds?: MapBoundsResolvers<ContextType>;
  MapCelestial?: MapCelestialResolvers<ContextType>;
  MapEdge?: MapEdgeResolvers<ContextType>;
  MapGeometry?: MapGeometryResolvers<ContextType>;
  MapLabel?: MapLabelResolvers<ContextType>;
  MapNode?: MapNodeResolvers<ContextType>;
  MapSovOwner?: MapSovOwnerResolvers<ContextType>;
  MapSovSystem?: MapSovSystemResolvers<ContextType>;
  MapSovereignty?: MapSovereigntyResolvers<ContextType>;
  MapSystemDetails?: MapSystemDetailsResolvers<ContextType>;
  MapSystemOwner?: MapSystemOwnerResolvers<ContextType>;
  MapSystemStargate?: MapSystemStargateResolvers<ContextType>;
  Moon?: MoonResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  Planet?: PlanetResolvers<ContextType>;
  Position?: PositionResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  QueueStatus?: QueueStatusResolvers<ContextType>;
  Race?: RaceResolvers<ContextType>;
  RedisMetrics?: RedisMetricsResolvers<ContextType>;
  RefreshCharacterResult?: RefreshCharacterResultResolvers<ContextType>;
  Region?: RegionResolvers<ContextType>;
  RegionCampaignCount?: RegionCampaignCountResolvers<ContextType>;
  RegionsResponse?: RegionsResponseResolvers<ContextType>;
  Session?: SessionResolvers<ContextType>;
  ShipTopKill?: ShipTopKillResolvers<ContextType>;
  SlotGroup?: SlotGroupResolvers<ContextType>;
  SolarSystem?: SolarSystemResolvers<ContextType>;
  SolarSystemCounts?: SolarSystemCountsResolvers<ContextType>;
  SolarSystemStats?: SolarSystemStatsResolvers<ContextType>;
  SolarSystemsResponse?: SolarSystemsResponseResolvers<ContextType>;
  SovereigntyAlert?: SovereigntyAlertResolvers<ContextType>;
  SovereigntyCampaign?: SovereigntyCampaignResolvers<ContextType>;
  SovereigntyCampaignHistoryPage?: SovereigntyCampaignHistoryPageResolvers<ContextType>;
  SovereigntyHolder?: SovereigntyHolderResolvers<ContextType>;
  SovereigntyOutcomeStats?: SovereigntyOutcomeStatsResolvers<ContextType>;
  SovereigntyOverview?: SovereigntyOverviewResolvers<ContextType>;
  SovereigntyStructureInfo?: SovereigntyStructureInfoResolvers<ContextType>;
  StandaloneWorkerStatus?: StandaloneWorkerStatusResolvers<ContextType>;
  Star?: StarResolvers<ContextType>;
  Stargate?: StargateResolvers<ContextType>;
  StargateDestination?: StargateDestinationResolvers<ContextType>;
  StartAllianceSyncPayload?: StartAllianceSyncPayloadResolvers<ContextType>;
  StartCategorySyncPayload?: StartCategorySyncPayloadResolvers<ContextType>;
  StartConstellationSyncPayload?: StartConstellationSyncPayloadResolvers<ContextType>;
  StartDogmaAttributeSyncPayload?: StartDogmaAttributeSyncPayloadResolvers<ContextType>;
  StartDogmaEffectSyncPayload?: StartDogmaEffectSyncPayloadResolvers<ContextType>;
  StartItemGroupSyncPayload?: StartItemGroupSyncPayloadResolvers<ContextType>;
  StartRegionSyncPayload?: StartRegionSyncPayloadResolvers<ContextType>;
  StartTypeDogmaSyncPayload?: StartTypeDogmaSyncPayloadResolvers<ContextType>;
  StartTypeSyncPayload?: StartTypeSyncPayloadResolvers<ContextType>;
  Station?: StationResolvers<ContextType>;
  Subscription?: SubscriptionResolvers<ContextType>;
  SyncMyKillmailsPayload?: SyncMyKillmailsPayloadResolvers<ContextType>;
  SystemActivity?: SystemActivityResolvers<ContextType>;
  SystemActivityStats?: SystemActivityStatsResolvers<ContextType>;
  TerritoryChange?: TerritoryChangeResolvers<ContextType>;
  TopAlliance?: TopAllianceResolvers<ContextType>;
  TopCorporation?: TopCorporationResolvers<ContextType>;
  TopFaction?: TopFactionResolvers<ContextType>;
  TopPilot?: TopPilotResolvers<ContextType>;
  TopRegion?: TopRegionResolvers<ContextType>;
  TopShip?: TopShipResolvers<ContextType>;
  TopSystem?: TopSystemResolvers<ContextType>;
  Type?: TypeResolvers<ContextType>;
  TypeDogmaAttribute?: TypeDogmaAttributeResolvers<ContextType>;
  TypeDogmaEffect?: TypeDogmaEffectResolvers<ContextType>;
  TypesResponse?: TypesResponseResolvers<ContextType>;
  UpdateUserPayload?: UpdateUserPayloadResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
  Victim?: VictimResolvers<ContextType>;
  WorkerStatus?: WorkerStatusResolvers<ContextType>;
};

