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

export type AddCharacterInput = {
  corporation?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};

export type Alliance = {
  __typename?: 'Alliance';
  creator_corporation_id: Scalars['Int']['output'];
  creator_id: Scalars['Int']['output'];
  date_founded: Scalars['String']['output'];
  executor_corporation_id: Scalars['Int']['output'];
  faction_id?: Maybe<Scalars['Int']['output']>;
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  ticker: Scalars['String']['output'];
};

export type AllianceFilter = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  ticker?: InputMaybe<Scalars['String']['input']>;
};

export type AlliancesResponse = {
  __typename?: 'AlliancesResponse';
  data: Array<Alliance>;
  pageInfo: PageInfo;
};

export type Attacker = {
  __typename?: 'Attacker';
  characterId?: Maybe<Scalars['Int']['output']>;
  characterName?: Maybe<Scalars['String']['output']>;
  corporationId?: Maybe<Scalars['Int']['output']>;
  finalBlow?: Maybe<Scalars['Boolean']['output']>;
  shipTypeId?: Maybe<Scalars['Int']['output']>;
  weaponTypeId?: Maybe<Scalars['Int']['output']>;
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

export type Character = {
  __typename?: 'Character';
  alliance?: Maybe<Scalars['String']['output']>;
  corporation?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  securityStatus?: Maybe<Scalars['Float']['output']>;
  user?: Maybe<User>;
};

export type CreateUserInput = {
  email: Scalars['String']['input'];
  name: Scalars['String']['input'];
};

export type Killmail = {
  __typename?: 'Killmail';
  attackers: Array<Attacker>;
  id: Scalars['ID']['output'];
  killmailHash: Scalars['String']['output'];
  killmailId: Scalars['Int']['output'];
  killmailTime: Scalars['String']['output'];
  totalValue?: Maybe<Scalars['Float']['output']>;
  victim: Victim;
};

export type Mutation = {
  __typename?: 'Mutation';
  addCharacter: Character;
  /** Authorization code ile authentication yapar ve token döner */
  authenticateWithCode: AuthPayload;
  createUser: User;
  /** Eve Online SSO login için authorization URL'i oluşturur */
  login: AuthUrl;
  /** Refresh token kullanarak yeni access token alır */
  refreshToken: AuthPayload;
  startAllianceSync?: Maybe<Scalars['Boolean']['output']>;
  /**
   * Kullanıcının killmail'lerini ESI'dan çeker ve database'e kaydeder
   * Requires: Authentication
   */
  syncMyKillmails: SyncResult;
  updateUser?: Maybe<User>;
};


export type MutationAddCharacterArgs = {
  input: AddCharacterInput;
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


export type MutationUpdateUserArgs = {
  id: Scalars['ID']['input'];
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

export type Query = {
  __typename?: 'Query';
  alliance?: Maybe<Alliance>;
  alliances: AlliancesResponse;
  character?: Maybe<Character>;
  charactersByUser: Array<Character>;
  /** Tek bir killmail'i getirir */
  killmail?: Maybe<Killmail>;
  /** Tüm killmail'leri listeler (pagination ile) */
  killmails: Array<Killmail>;
  /** Mevcut authenticated kullanıcının bilgilerini döner */
  me?: Maybe<User>;
  /**
   * Login olan kullanıcının corporation killmail'lerini getirir
   * Requires: Authentication + esi-killmails.read_corporation_killmails.v1 scope
   */
  myCorporationKillmails: Array<Killmail>;
  /**
   * Login olan kullanıcının kendi killmail'lerini getirir
   * Requires: Authentication
   */
  myKillmails: Array<Killmail>;
  user?: Maybe<User>;
  users: Array<User>;
};


export type QueryAllianceArgs = {
  id: Scalars['Int']['input'];
};


export type QueryAlliancesArgs = {
  filter?: InputMaybe<AllianceFilter>;
};


export type QueryCharacterArgs = {
  id: Scalars['ID']['input'];
};


export type QueryCharactersByUserArgs = {
  userId: Scalars['ID']['input'];
};


export type QueryKillmailArgs = {
  id: Scalars['ID']['input'];
};


export type QueryKillmailsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryMyCorporationKillmailsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryMyKillmailsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryUserArgs = {
  id: Scalars['ID']['input'];
};

export type SyncResult = {
  __typename?: 'SyncResult';
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
  syncedCount: Scalars['Int']['output'];
};

export type UpdateUserInput = {
  email?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
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
  characterId?: Maybe<Scalars['Int']['output']>;
  characterName?: Maybe<Scalars['String']['output']>;
  corporationId?: Maybe<Scalars['Int']['output']>;
  corporationName?: Maybe<Scalars['String']['output']>;
  damageTaken?: Maybe<Scalars['Int']['output']>;
  shipTypeId?: Maybe<Scalars['Int']['output']>;
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
  AddCharacterInput: AddCharacterInput;
  Alliance: ResolverTypeWrapper<Alliance>;
  AllianceFilter: AllianceFilter;
  AlliancesResponse: ResolverTypeWrapper<AlliancesResponse>;
  Attacker: ResolverTypeWrapper<Attacker>;
  AuthPayload: ResolverTypeWrapper<AuthPayload>;
  AuthUrl: ResolverTypeWrapper<AuthUrl>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Character: ResolverTypeWrapper<Character>;
  CreateUserInput: CreateUserInput;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Killmail: ResolverTypeWrapper<Killmail>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  PageInfo: ResolverTypeWrapper<PageInfo>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  SyncResult: ResolverTypeWrapper<SyncResult>;
  UpdateUserInput: UpdateUserInput;
  User: ResolverTypeWrapper<User>;
  Victim: ResolverTypeWrapper<Victim>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  AddCharacterInput: AddCharacterInput;
  Alliance: Alliance;
  AllianceFilter: AllianceFilter;
  AlliancesResponse: AlliancesResponse;
  Attacker: Attacker;
  AuthPayload: AuthPayload;
  AuthUrl: AuthUrl;
  Boolean: Scalars['Boolean']['output'];
  Character: Character;
  CreateUserInput: CreateUserInput;
  Float: Scalars['Float']['output'];
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  Killmail: Killmail;
  Mutation: Record<PropertyKey, never>;
  PageInfo: PageInfo;
  Query: Record<PropertyKey, never>;
  String: Scalars['String']['output'];
  SyncResult: SyncResult;
  UpdateUserInput: UpdateUserInput;
  User: User;
  Victim: Victim;
};

export type AllianceResolvers<ContextType = any, ParentType extends ResolversParentTypes['Alliance'] = ResolversParentTypes['Alliance']> = {
  creator_corporation_id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  creator_id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  date_founded?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  executor_corporation_id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  faction_id?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ticker?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type AlliancesResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['AlliancesResponse'] = ResolversParentTypes['AlliancesResponse']> = {
  data?: Resolver<Array<ResolversTypes['Alliance']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type AttackerResolvers<ContextType = any, ParentType extends ResolversParentTypes['Attacker'] = ResolversParentTypes['Attacker']> = {
  characterId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  characterName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  corporationId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  finalBlow?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  shipTypeId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  weaponTypeId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
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

export type CharacterResolvers<ContextType = any, ParentType extends ResolversParentTypes['Character'] = ResolversParentTypes['Character']> = {
  alliance?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  corporation?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  securityStatus?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  user?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
};

export type KillmailResolvers<ContextType = any, ParentType extends ResolversParentTypes['Killmail'] = ResolversParentTypes['Killmail']> = {
  attackers?: Resolver<Array<ResolversTypes['Attacker']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  killmailHash?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  killmailId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  killmailTime?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  totalValue?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  victim?: Resolver<ResolversTypes['Victim'], ParentType, ContextType>;
};

export type MutationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  addCharacter?: Resolver<ResolversTypes['Character'], ParentType, ContextType, RequireFields<MutationAddCharacterArgs, 'input'>>;
  authenticateWithCode?: Resolver<ResolversTypes['AuthPayload'], ParentType, ContextType, RequireFields<MutationAuthenticateWithCodeArgs, 'code' | 'state'>>;
  createUser?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationCreateUserArgs, 'input'>>;
  login?: Resolver<ResolversTypes['AuthUrl'], ParentType, ContextType>;
  refreshToken?: Resolver<ResolversTypes['AuthPayload'], ParentType, ContextType, RequireFields<MutationRefreshTokenArgs, 'refreshToken'>>;
  startAllianceSync?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  syncMyKillmails?: Resolver<ResolversTypes['SyncResult'], ParentType, ContextType>;
  updateUser?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType, RequireFields<MutationUpdateUserArgs, 'id' | 'input'>>;
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

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  alliance?: Resolver<Maybe<ResolversTypes['Alliance']>, ParentType, ContextType, RequireFields<QueryAllianceArgs, 'id'>>;
  alliances?: Resolver<ResolversTypes['AlliancesResponse'], ParentType, ContextType, Partial<QueryAlliancesArgs>>;
  character?: Resolver<Maybe<ResolversTypes['Character']>, ParentType, ContextType, RequireFields<QueryCharacterArgs, 'id'>>;
  charactersByUser?: Resolver<Array<ResolversTypes['Character']>, ParentType, ContextType, RequireFields<QueryCharactersByUserArgs, 'userId'>>;
  killmail?: Resolver<Maybe<ResolversTypes['Killmail']>, ParentType, ContextType, RequireFields<QueryKillmailArgs, 'id'>>;
  killmails?: Resolver<Array<ResolversTypes['Killmail']>, ParentType, ContextType, Partial<QueryKillmailsArgs>>;
  me?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  myCorporationKillmails?: Resolver<Array<ResolversTypes['Killmail']>, ParentType, ContextType, Partial<QueryMyCorporationKillmailsArgs>>;
  myKillmails?: Resolver<Array<ResolversTypes['Killmail']>, ParentType, ContextType, Partial<QueryMyKillmailsArgs>>;
  user?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType, RequireFields<QueryUserArgs, 'id'>>;
  users?: Resolver<Array<ResolversTypes['User']>, ParentType, ContextType>;
};

export type SyncResultResolvers<ContextType = any, ParentType extends ResolversParentTypes['SyncResult'] = ResolversParentTypes['SyncResult']> = {
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  syncedCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type UserResolvers<ContextType = any, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = {
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type VictimResolvers<ContextType = any, ParentType extends ResolversParentTypes['Victim'] = ResolversParentTypes['Victim']> = {
  characterId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  characterName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  corporationId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  corporationName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  damageTaken?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  shipTypeId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
};

export type Resolvers<ContextType = any> = {
  Alliance?: AllianceResolvers<ContextType>;
  AlliancesResponse?: AlliancesResponseResolvers<ContextType>;
  Attacker?: AttackerResolvers<ContextType>;
  AuthPayload?: AuthPayloadResolvers<ContextType>;
  AuthUrl?: AuthUrlResolvers<ContextType>;
  Character?: CharacterResolvers<ContextType>;
  Killmail?: KillmailResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  SyncResult?: SyncResultResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
  Victim?: VictimResolvers<ContextType>;
};

