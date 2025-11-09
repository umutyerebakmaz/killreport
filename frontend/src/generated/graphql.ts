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

export type AddCharacterInput = {
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
  corporation?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};

export type AddCharacterPayload = {
  __typename?: 'AddCharacterPayload';
  character?: Maybe<Character>;
  clientMutationId?: Maybe<Scalars['String']['output']>;
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
  limit?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  ticker?: InputMaybe<Scalars['String']['input']>;
};

export type AllianceMetrics = {
  __typename?: 'AllianceMetrics';
  corporationCountDelta7d?: Maybe<Scalars['Int']['output']>;
  corporationCountDelta30d?: Maybe<Scalars['Int']['output']>;
  corporationCountGrowthRate7d?: Maybe<Scalars['Float']['output']>;
  corporationCountGrowthRate30d?: Maybe<Scalars['Float']['output']>;
  memberCountDelta7d?: Maybe<Scalars['Int']['output']>;
  memberCountDelta30d?: Maybe<Scalars['Int']['output']>;
  memberCountGrowthRate7d?: Maybe<Scalars['Float']['output']>;
  memberCountGrowthRate30d?: Maybe<Scalars['Float']['output']>;
};

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

export type Character = {
  __typename?: 'Character';
  alliance?: Maybe<Scalars['String']['output']>;
  corporation?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  securityStatus?: Maybe<Scalars['Float']['output']>;
  user?: Maybe<User>;
};

export type Corporation = {
  __typename?: 'Corporation';
  alliance?: Maybe<Alliance>;
  alliance_id?: Maybe<Scalars['Int']['output']>;
  ceo_id: Scalars['Int']['output'];
  creator_id: Scalars['Int']['output'];
  date_founded?: Maybe<Scalars['String']['output']>;
  faction_id?: Maybe<Scalars['Int']['output']>;
  id: Scalars['Int']['output'];
  member_count: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  tax_rate: Scalars['Float']['output'];
  ticker: Scalars['String']['output'];
  url?: Maybe<Scalars['String']['output']>;
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
  addCharacter: AddCharacterPayload;
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
  character?: Maybe<Character>;
  charactersByUser: Array<Character>;
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


export type QueryCharacterArgs = {
  id: Scalars['ID']['input'];
};


export type QueryCharactersByUserArgs = {
  userId: Scalars['ID']['input'];
};


export type QueryCorporationArgs = {
  id: Scalars['Int']['input'];
};


export type QueryCorporationsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
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

export type AllianceQueryVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type AllianceQuery = { __typename?: 'Query', alliance?: { __typename?: 'Alliance', id: number, name: string, ticker: string, date_founded: string, memberCount: number, corporationCount: number, metrics?: { __typename?: 'AllianceMetrics', memberCountDelta7d?: number | null, memberCountDelta30d?: number | null, corporationCountDelta7d?: number | null, corporationCountDelta30d?: number | null, memberCountGrowthRate7d?: number | null, memberCountGrowthRate30d?: number | null } | null, executor?: { __typename?: 'Corporation', name: string } | null, createdByCorporation?: { __typename?: 'Corporation', name: string } | null, createdBy?: { __typename?: 'Character', name: string } | null } | null };

export type AlliancesQueryVariables = Exact<{
  filter?: InputMaybe<AllianceFilter>;
}>;


export type AlliancesQuery = { __typename?: 'Query', alliances: { __typename?: 'AllianceConnection', edges: Array<{ __typename?: 'AllianceEdge', cursor: string, node: { __typename?: 'Alliance', id: number, name: string, memberCount: number, corporationCount: number, metrics?: { __typename?: 'AllianceMetrics', memberCountDelta7d?: number | null, memberCountDelta30d?: number | null, corporationCountDelta7d?: number | null, corporationCountDelta30d?: number | null, memberCountGrowthRate7d?: number | null, memberCountGrowthRate30d?: number | null } | null } }>, pageInfo: { __typename?: 'PageInfo', currentPage: number, totalPages: number, totalCount: number, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type CorporationsQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
}>;


export type CorporationsQuery = { __typename?: 'Query', corporations: { __typename?: 'CorporationConnection', edges: Array<{ __typename?: 'CorporationEdge', node: { __typename?: 'Corporation', id: number, name: string, ticker: string, member_count: number, alliance?: { __typename?: 'Alliance', id: number, name: string, ticker: string } | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean } } };


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
      memberCountDelta30d
      corporationCountDelta7d
      corporationCountDelta30d
      memberCountGrowthRate7d
      memberCountGrowthRate30d
    }
    executor {
      name
    }
    createdByCorporation {
      name
    }
    createdBy {
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
export function useAllianceSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AllianceQuery, AllianceQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<AllianceQuery, AllianceQueryVariables>(AllianceDocument, options);
        }
export type AllianceQueryHookResult = ReturnType<typeof useAllianceQuery>;
export type AllianceLazyQueryHookResult = ReturnType<typeof useAllianceLazyQuery>;
export type AllianceSuspenseQueryHookResult = ReturnType<typeof useAllianceSuspenseQuery>;
export type AllianceQueryResult = Apollo.QueryResult<AllianceQuery, AllianceQueryVariables>;
export const AlliancesDocument = gql`
    query Alliances($filter: AllianceFilter) {
  alliances(filter: $filter) {
    edges {
      node {
        id
        name
        memberCount
        corporationCount
        metrics {
          memberCountDelta7d
          memberCountDelta30d
          corporationCountDelta7d
          corporationCountDelta30d
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
export function useAlliancesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AlliancesQuery, AlliancesQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<AlliancesQuery, AlliancesQueryVariables>(AlliancesDocument, options);
        }
export type AlliancesQueryHookResult = ReturnType<typeof useAlliancesQuery>;
export type AlliancesLazyQueryHookResult = ReturnType<typeof useAlliancesLazyQuery>;
export type AlliancesSuspenseQueryHookResult = ReturnType<typeof useAlliancesSuspenseQuery>;
export type AlliancesQueryResult = Apollo.QueryResult<AlliancesQuery, AlliancesQueryVariables>;
export const CorporationsDocument = gql`
    query Corporations($first: Int) {
  corporations(first: $first) {
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
    pageInfo {
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
 *      first: // value for 'first'
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
export function useCorporationsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CorporationsQuery, CorporationsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CorporationsQuery, CorporationsQueryVariables>(CorporationsDocument, options);
        }
export type CorporationsQueryHookResult = ReturnType<typeof useCorporationsQuery>;
export type CorporationsLazyQueryHookResult = ReturnType<typeof useCorporationsLazyQuery>;
export type CorporationsSuspenseQueryHookResult = ReturnType<typeof useCorporationsSuspenseQuery>;
export type CorporationsQueryResult = Apollo.QueryResult<CorporationsQuery, CorporationsQueryVariables>;