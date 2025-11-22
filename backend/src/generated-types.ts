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

export type Alliance = {
  __typename?: 'Alliance';
  corporationCount: Scalars['Int']['output'];
  corporations?: Maybe<Array<Corporation>>;
  createdBy?: Maybe<Character>;
  createdByCorporation?: Maybe<Corporation>;
  creator_corporation_id: Scalars['Int']['output'];
  creator_id: Scalars['Int']['output'];
  date_founded: Scalars['String']['output'];
  executor?: Maybe<Corporation>;
  executor_corporation_id: Scalars['Int']['output'];
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
  allianceId?: Maybe<Scalars['Int']['output']>;
  allianceName?: Maybe<Scalars['String']['output']>;
  characterId?: Maybe<Scalars['Int']['output']>;
  characterName?: Maybe<Scalars['String']['output']>;
  corporationId?: Maybe<Scalars['Int']['output']>;
  corporationName?: Maybe<Scalars['String']['output']>;
  damageDone: Scalars['Int']['output'];
  factionId?: Maybe<Scalars['Int']['output']>;
  finalBlow: Scalars['Boolean']['output'];
  securityStatus: Scalars['Float']['output'];
  shipTypeId?: Maybe<Scalars['Int']['output']>;
  shipTypeName?: Maybe<Scalars['String']['output']>;
  weaponTypeId?: Maybe<Scalars['Int']['output']>;
  weaponTypeName?: Maybe<Scalars['String']['output']>;
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
  race_id: Scalars['Int']['output'];
};

export type Character = {
  __typename?: 'Character';
  alliance?: Maybe<Alliance>;
  alliance_id?: Maybe<Scalars['Int']['output']>;
  birthday: Scalars['String']['output'];
  bloodline?: Maybe<Bloodline>;
  bloodline_id: Scalars['Int']['output'];
  corporation?: Maybe<Corporation>;
  corporation_id: Scalars['Int']['output'];
  description?: Maybe<Scalars['String']['output']>;
  faction_id?: Maybe<Scalars['Int']['output']>;
  gender: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  race?: Maybe<Race>;
  race_id: Scalars['Int']['output'];
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

export type Corporation = {
  __typename?: 'Corporation';
  alliance?: Maybe<Alliance>;
  alliance_id?: Maybe<Scalars['Int']['output']>;
  ceo?: Maybe<Character>;
  ceo_id: Scalars['Int']['output'];
  creator?: Maybe<Character>;
  creator_id: Scalars['Int']['output'];
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

export type Killmail = {
  __typename?: 'Killmail';
  attackers: Array<Attacker>;
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  items: Array<KillmailItem>;
  killmailHash: Scalars['String']['output'];
  killmailId: Scalars['Int']['output'];
  killmailTime: Scalars['String']['output'];
  solarSystemId: Scalars['Int']['output'];
  totalValue?: Maybe<Scalars['Float']['output']>;
  victim: Victim;
};

export type KillmailConnection = {
  __typename?: 'KillmailConnection';
  edges: Array<KillmailEdge>;
  pageInfo: PageInfo;
};

export type KillmailEdge = {
  __typename?: 'KillmailEdge';
  cursor: Scalars['String']['output'];
  node: Killmail;
};

export type KillmailItem = {
  __typename?: 'KillmailItem';
  flag: Scalars['Int']['output'];
  itemTypeId: Scalars['Int']['output'];
  itemTypeName?: Maybe<Scalars['String']['output']>;
  quantityDestroyed?: Maybe<Scalars['Int']['output']>;
  quantityDropped?: Maybe<Scalars['Int']['output']>;
  singleton: Scalars['Int']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  _empty?: Maybe<Scalars['String']['output']>;
  /** Authorization code ile authentication yapar ve token döner */
  authenticateWithCode: AuthPayload;
  createUser: CreateUserPayload;
  /** Eve Online SSO login için authorization URL'i oluşturur */
  login: AuthUrl;
  /** Refresh token kullanarak yeni access token alır */
  refreshToken: AuthPayload;
  startAllianceSync: StartAllianceSyncPayload;
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


export type MutationCreateUserArgs = {
  input: CreateUserInput;
};


export type MutationRefreshTokenArgs = {
  refreshToken: Scalars['String']['input'];
};


export type MutationStartAllianceSyncArgs = {
  input: StartAllianceSyncInput;
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
  alliance?: Maybe<Alliance>;
  alliances: AllianceConnection;
  bloodline?: Maybe<Bloodline>;
  bloodlines: Array<Bloodline>;
  character?: Maybe<Character>;
  characters: CharacterConnection;
  corporation?: Maybe<Corporation>;
  corporations: CorporationConnection;
  /** Fetches a single killmail */
  killmail?: Maybe<Killmail>;
  /** Lists all killmails (with pagination using Relay-style connection) */
  killmails: KillmailConnection;
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


export type QueryCharacterArgs = {
  id: Scalars['Int']['input'];
};


export type QueryCharactersArgs = {
  filter?: InputMaybe<CharacterFilter>;
};


export type QueryCorporationArgs = {
  id: Scalars['Int']['input'];
};


export type QueryCorporationsArgs = {
  filter?: InputMaybe<CorporationFilter>;
};


export type QueryKillmailArgs = {
  id: Scalars['ID']['input'];
};


export type QueryKillmailsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
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


export type QueryUserArgs = {
  id: Scalars['ID']['input'];
};

export type QueueStatus = {
  __typename?: 'QueueStatus';
  /** Is the queue currently active */
  active: Scalars['Boolean']['output'];
  /** Number of messages currently being processed */
  consumerCount: Scalars['Int']['output'];
  /** Number of messages waiting to be processed */
  messageCount: Scalars['Int']['output'];
  /** Name of the queue */
  name: Scalars['String']['output'];
};

export type Race = {
  __typename?: 'Race';
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
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

export type Subscription = {
  __typename?: 'Subscription';
  _empty?: Maybe<Scalars['String']['output']>;
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
  allianceId?: Maybe<Scalars['Int']['output']>;
  allianceName?: Maybe<Scalars['String']['output']>;
  characterId?: Maybe<Scalars['Int']['output']>;
  characterName?: Maybe<Scalars['String']['output']>;
  corporationId: Scalars['Int']['output'];
  corporationName?: Maybe<Scalars['String']['output']>;
  damageTaken: Scalars['Int']['output'];
  factionId?: Maybe<Scalars['Int']['output']>;
  position?: Maybe<Position>;
  shipTypeId: Scalars['Int']['output'];
  shipTypeName?: Maybe<Scalars['String']['output']>;
};

export type WorkerStatus = {
  __typename?: 'WorkerStatus';
  /** Overall system health */
  healthy: Scalars['Boolean']['output'];
  /** Status of individual queues */
  queues: Array<QueueStatus>;
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
  Character: ResolverTypeWrapper<Character>;
  CharacterConnection: ResolverTypeWrapper<CharacterConnection>;
  CharacterEdge: ResolverTypeWrapper<CharacterEdge>;
  CharacterFilter: CharacterFilter;
  CharacterOrderBy: CharacterOrderBy;
  Corporation: ResolverTypeWrapper<Corporation>;
  CorporationConnection: ResolverTypeWrapper<CorporationConnection>;
  CorporationEdge: ResolverTypeWrapper<CorporationEdge>;
  CorporationFilter: CorporationFilter;
  CorporationMetrics: ResolverTypeWrapper<CorporationMetrics>;
  CorporationOrderBy: CorporationOrderBy;
  CorporationSnapshot: ResolverTypeWrapper<CorporationSnapshot>;
  CreateUserInput: CreateUserInput;
  CreateUserPayload: ResolverTypeWrapper<CreateUserPayload>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Killmail: ResolverTypeWrapper<Killmail>;
  KillmailConnection: ResolverTypeWrapper<KillmailConnection>;
  KillmailEdge: ResolverTypeWrapper<KillmailEdge>;
  KillmailItem: ResolverTypeWrapper<KillmailItem>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  PageInfo: ResolverTypeWrapper<PageInfo>;
  Position: ResolverTypeWrapper<Position>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  QueueStatus: ResolverTypeWrapper<QueueStatus>;
  Race: ResolverTypeWrapper<Race>;
  StartAllianceSyncInput: StartAllianceSyncInput;
  StartAllianceSyncPayload: ResolverTypeWrapper<StartAllianceSyncPayload>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Subscription: ResolverTypeWrapper<Record<PropertyKey, never>>;
  SyncMyKillmailsInput: SyncMyKillmailsInput;
  SyncMyKillmailsPayload: ResolverTypeWrapper<SyncMyKillmailsPayload>;
  UpdateUserInput: UpdateUserInput;
  UpdateUserPayload: ResolverTypeWrapper<UpdateUserPayload>;
  User: ResolverTypeWrapper<User>;
  Victim: ResolverTypeWrapper<Victim>;
  WorkerStatus: ResolverTypeWrapper<WorkerStatus>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
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
  Character: Character;
  CharacterConnection: CharacterConnection;
  CharacterEdge: CharacterEdge;
  CharacterFilter: CharacterFilter;
  Corporation: Corporation;
  CorporationConnection: CorporationConnection;
  CorporationEdge: CorporationEdge;
  CorporationFilter: CorporationFilter;
  CorporationMetrics: CorporationMetrics;
  CorporationSnapshot: CorporationSnapshot;
  CreateUserInput: CreateUserInput;
  CreateUserPayload: CreateUserPayload;
  Float: Scalars['Float']['output'];
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  Killmail: Killmail;
  KillmailConnection: KillmailConnection;
  KillmailEdge: KillmailEdge;
  KillmailItem: KillmailItem;
  Mutation: Record<PropertyKey, never>;
  PageInfo: PageInfo;
  Position: Position;
  Query: Record<PropertyKey, never>;
  QueueStatus: QueueStatus;
  Race: Race;
  StartAllianceSyncInput: StartAllianceSyncInput;
  StartAllianceSyncPayload: StartAllianceSyncPayload;
  String: Scalars['String']['output'];
  Subscription: Record<PropertyKey, never>;
  SyncMyKillmailsInput: SyncMyKillmailsInput;
  SyncMyKillmailsPayload: SyncMyKillmailsPayload;
  UpdateUserInput: UpdateUserInput;
  UpdateUserPayload: UpdateUserPayload;
  User: User;
  Victim: Victim;
  WorkerStatus: WorkerStatus;
};

export type AllianceResolvers<ContextType = any, ParentType extends ResolversParentTypes['Alliance'] = ResolversParentTypes['Alliance']> = {
  corporationCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  corporations?: Resolver<Maybe<Array<ResolversTypes['Corporation']>>, ParentType, ContextType>;
  createdBy?: Resolver<Maybe<ResolversTypes['Character']>, ParentType, ContextType>;
  createdByCorporation?: Resolver<Maybe<ResolversTypes['Corporation']>, ParentType, ContextType>;
  creator_corporation_id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  creator_id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  date_founded?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  executor?: Resolver<Maybe<ResolversTypes['Corporation']>, ParentType, ContextType>;
  executor_corporation_id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
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
  allianceId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  allianceName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  characterId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  characterName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  corporationId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  corporationName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  damageDone?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  factionId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  finalBlow?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  securityStatus?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  shipTypeId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  shipTypeName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  weaponTypeId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  weaponTypeName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
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
  race_id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type CharacterResolvers<ContextType = any, ParentType extends ResolversParentTypes['Character'] = ResolversParentTypes['Character']> = {
  alliance?: Resolver<Maybe<ResolversTypes['Alliance']>, ParentType, ContextType>;
  alliance_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  birthday?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  bloodline?: Resolver<Maybe<ResolversTypes['Bloodline']>, ParentType, ContextType>;
  bloodline_id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  corporation?: Resolver<Maybe<ResolversTypes['Corporation']>, ParentType, ContextType>;
  corporation_id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  faction_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  gender?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  race?: Resolver<Maybe<ResolversTypes['Race']>, ParentType, ContextType>;
  race_id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
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

export type CorporationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Corporation'] = ResolversParentTypes['Corporation']> = {
  alliance?: Resolver<Maybe<ResolversTypes['Alliance']>, ParentType, ContextType>;
  alliance_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  ceo?: Resolver<Maybe<ResolversTypes['Character']>, ParentType, ContextType>;
  ceo_id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  creator?: Resolver<Maybe<ResolversTypes['Character']>, ParentType, ContextType>;
  creator_id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
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

export type KillmailResolvers<ContextType = any, ParentType extends ResolversParentTypes['Killmail'] = ResolversParentTypes['Killmail']> = {
  attackers?: Resolver<Array<ResolversTypes['Attacker']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  items?: Resolver<Array<ResolversTypes['KillmailItem']>, ParentType, ContextType>;
  killmailHash?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  killmailId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  killmailTime?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  solarSystemId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalValue?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  victim?: Resolver<ResolversTypes['Victim'], ParentType, ContextType>;
};

export type KillmailConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['KillmailConnection'] = ResolversParentTypes['KillmailConnection']> = {
  edges?: Resolver<Array<ResolversTypes['KillmailEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type KillmailEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['KillmailEdge'] = ResolversParentTypes['KillmailEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Killmail'], ParentType, ContextType>;
};

export type KillmailItemResolvers<ContextType = any, ParentType extends ResolversParentTypes['KillmailItem'] = ResolversParentTypes['KillmailItem']> = {
  flag?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  itemTypeId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  itemTypeName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  quantityDestroyed?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  quantityDropped?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  singleton?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type MutationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  _empty?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  authenticateWithCode?: Resolver<ResolversTypes['AuthPayload'], ParentType, ContextType, RequireFields<MutationAuthenticateWithCodeArgs, 'code' | 'state'>>;
  createUser?: Resolver<ResolversTypes['CreateUserPayload'], ParentType, ContextType, RequireFields<MutationCreateUserArgs, 'input'>>;
  login?: Resolver<ResolversTypes['AuthUrl'], ParentType, ContextType>;
  refreshToken?: Resolver<ResolversTypes['AuthPayload'], ParentType, ContextType, RequireFields<MutationRefreshTokenArgs, 'refreshToken'>>;
  startAllianceSync?: Resolver<ResolversTypes['StartAllianceSyncPayload'], ParentType, ContextType, RequireFields<MutationStartAllianceSyncArgs, 'input'>>;
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
  alliance?: Resolver<Maybe<ResolversTypes['Alliance']>, ParentType, ContextType, RequireFields<QueryAllianceArgs, 'id'>>;
  alliances?: Resolver<ResolversTypes['AllianceConnection'], ParentType, ContextType, Partial<QueryAlliancesArgs>>;
  bloodline?: Resolver<Maybe<ResolversTypes['Bloodline']>, ParentType, ContextType, RequireFields<QueryBloodlineArgs, 'id'>>;
  bloodlines?: Resolver<Array<ResolversTypes['Bloodline']>, ParentType, ContextType>;
  character?: Resolver<Maybe<ResolversTypes['Character']>, ParentType, ContextType, RequireFields<QueryCharacterArgs, 'id'>>;
  characters?: Resolver<ResolversTypes['CharacterConnection'], ParentType, ContextType, Partial<QueryCharactersArgs>>;
  corporation?: Resolver<Maybe<ResolversTypes['Corporation']>, ParentType, ContextType, RequireFields<QueryCorporationArgs, 'id'>>;
  corporations?: Resolver<ResolversTypes['CorporationConnection'], ParentType, ContextType, Partial<QueryCorporationsArgs>>;
  killmail?: Resolver<Maybe<ResolversTypes['Killmail']>, ParentType, ContextType, RequireFields<QueryKillmailArgs, 'id'>>;
  killmails?: Resolver<ResolversTypes['KillmailConnection'], ParentType, ContextType, Partial<QueryKillmailsArgs>>;
  me?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  myCorporationKillmails?: Resolver<Array<ResolversTypes['Killmail']>, ParentType, ContextType, Partial<QueryMyCorporationKillmailsArgs>>;
  myKillmails?: Resolver<Array<ResolversTypes['Killmail']>, ParentType, ContextType, Partial<QueryMyKillmailsArgs>>;
  race?: Resolver<Maybe<ResolversTypes['Race']>, ParentType, ContextType, RequireFields<QueryRaceArgs, 'id'>>;
  races?: Resolver<Array<ResolversTypes['Race']>, ParentType, ContextType>;
  user?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType, RequireFields<QueryUserArgs, 'id'>>;
  users?: Resolver<Array<ResolversTypes['User']>, ParentType, ContextType>;
  workerStatus?: Resolver<ResolversTypes['WorkerStatus'], ParentType, ContextType>;
};

export type QueueStatusResolvers<ContextType = any, ParentType extends ResolversParentTypes['QueueStatus'] = ResolversParentTypes['QueueStatus']> = {
  active?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  consumerCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  messageCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type RaceResolvers<ContextType = any, ParentType extends ResolversParentTypes['Race'] = ResolversParentTypes['Race']> = {
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type StartAllianceSyncPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['StartAllianceSyncPayload'] = ResolversParentTypes['StartAllianceSyncPayload']> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type SubscriptionResolvers<ContextType = any, ParentType extends ResolversParentTypes['Subscription'] = ResolversParentTypes['Subscription']> = {
  _empty?: SubscriptionResolver<Maybe<ResolversTypes['String']>, "_empty", ParentType, ContextType>;
  workerStatusUpdates?: SubscriptionResolver<ResolversTypes['WorkerStatus'], "workerStatusUpdates", ParentType, ContextType>;
};

export type SyncMyKillmailsPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['SyncMyKillmailsPayload'] = ResolversParentTypes['SyncMyKillmailsPayload']> = {
  clientMutationId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  syncedCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
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
  allianceId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  allianceName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  characterId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  characterName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  corporationId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  corporationName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  damageTaken?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  factionId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  position?: Resolver<Maybe<ResolversTypes['Position']>, ParentType, ContextType>;
  shipTypeId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  shipTypeName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type WorkerStatusResolvers<ContextType = any, ParentType extends ResolversParentTypes['WorkerStatus'] = ResolversParentTypes['WorkerStatus']> = {
  healthy?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  queues?: Resolver<Array<ResolversTypes['QueueStatus']>, ParentType, ContextType>;
  timestamp?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type Resolvers<ContextType = any> = {
  Alliance?: AllianceResolvers<ContextType>;
  AllianceConnection?: AllianceConnectionResolvers<ContextType>;
  AllianceEdge?: AllianceEdgeResolvers<ContextType>;
  AllianceMetrics?: AllianceMetricsResolvers<ContextType>;
  AllianceSnapshot?: AllianceSnapshotResolvers<ContextType>;
  Attacker?: AttackerResolvers<ContextType>;
  AuthPayload?: AuthPayloadResolvers<ContextType>;
  AuthUrl?: AuthUrlResolvers<ContextType>;
  Bloodline?: BloodlineResolvers<ContextType>;
  Character?: CharacterResolvers<ContextType>;
  CharacterConnection?: CharacterConnectionResolvers<ContextType>;
  CharacterEdge?: CharacterEdgeResolvers<ContextType>;
  Corporation?: CorporationResolvers<ContextType>;
  CorporationConnection?: CorporationConnectionResolvers<ContextType>;
  CorporationEdge?: CorporationEdgeResolvers<ContextType>;
  CorporationMetrics?: CorporationMetricsResolvers<ContextType>;
  CorporationSnapshot?: CorporationSnapshotResolvers<ContextType>;
  CreateUserPayload?: CreateUserPayloadResolvers<ContextType>;
  Killmail?: KillmailResolvers<ContextType>;
  KillmailConnection?: KillmailConnectionResolvers<ContextType>;
  KillmailEdge?: KillmailEdgeResolvers<ContextType>;
  KillmailItem?: KillmailItemResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  Position?: PositionResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  QueueStatus?: QueueStatusResolvers<ContextType>;
  Race?: RaceResolvers<ContextType>;
  StartAllianceSyncPayload?: StartAllianceSyncPayloadResolvers<ContextType>;
  Subscription?: SubscriptionResolvers<ContextType>;
  SyncMyKillmailsPayload?: SyncMyKillmailsPayloadResolvers<ContextType>;
  UpdateUserPayload?: UpdateUserPayloadResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
  Victim?: VictimResolvers<ContextType>;
  WorkerStatus?: WorkerStatusResolvers<ContextType>;
};

