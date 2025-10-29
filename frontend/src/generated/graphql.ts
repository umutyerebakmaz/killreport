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
  corporation?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};

export type Alliance = {
  __typename?: 'Alliance';
  corporations?: Maybe<Array<Corporation>>;
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
   * Fetches user's killmails from ESI and saves to database
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
  corporation?: Maybe<Corporation>;
  /** Fetches a single killmail */
  killmail?: Maybe<Killmail>;
  /** Lists all killmails (with pagination) */
  killmails: Array<Killmail>;
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

export type AllianceQueryVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type AllianceQuery = { __typename?: 'Query', alliance?: { __typename?: 'Alliance', id: number, name: string, ticker: string, date_founded: string, creator_corporation_id: number, creator_id: number, executor_corporation_id: number, faction_id?: number | null } | null };

export type AlliancesQueryVariables = Exact<{
  filter?: InputMaybe<AllianceFilter>;
}>;


export type AlliancesQuery = { __typename?: 'Query', alliances: { __typename?: 'AlliancesResponse', data: Array<{ __typename?: 'Alliance', id: number, name: string, ticker: string, date_founded: string, creator_corporation_id: number, creator_id: number, executor_corporation_id: number, faction_id?: number | null }>, pageInfo: { __typename?: 'PageInfo', currentPage: number, totalPages: number, totalCount: number, hasNextPage: boolean, hasPreviousPage: boolean } } };


export const AllianceDocument = gql`
    query Alliance($id: Int!) {
  alliance(id: $id) {
    id
    name
    ticker
    date_founded
    creator_corporation_id
    creator_id
    executor_corporation_id
    faction_id
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
    data {
      id
      name
      ticker
      date_founded
      creator_corporation_id
      creator_id
      executor_corporation_id
      faction_id
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