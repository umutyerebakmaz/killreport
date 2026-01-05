import { ApolloClient, ApolloLink, FetchResult, HttpLink, InMemoryCache, NextLink, Observable, Operation, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { getMainDefinition } from '@apollo/client/utilities';
import { ClientOptions, createClient } from 'graphql-sse';

// SSE Link for subscriptions using graphql-sse
class SSELink extends ApolloLink {
    private client: ReturnType<typeof createClient>;

    constructor(options: ClientOptions) {
        super();
        this.client = createClient(options);
    }

    request(operation: Operation, forward?: NextLink): Observable<FetchResult> {
        console.log('🔌 SSELink: Subscribing to operation:', operation.operationName);
        return new Observable<FetchResult>((observer) => {
            return this.client.subscribe(
                { ...operation, query: operation.query.loc?.source.body || '' },
                {
                    next: (data) => {
                        console.log('📨 SSELink: Received data for', operation.operationName, data);
                        observer.next(data as FetchResult);
                    },
                    complete: () => {
                        console.log('✅ SSELink: Complete for', operation.operationName);
                        observer.complete();
                    },
                    error: (err) => {
                        console.error('❌ SSELink: Error for', operation.operationName, err);
                        observer.error(err);
                    },
                }
            );
        });
    }
}

// Lazy initialization - only create client on first use (client-side only)
let apolloClient: ApolloClient<any> | null = null;

// Token refresh helper
async function refreshAccessToken(): Promise<string | null> {
    try {
        const refreshToken = localStorage.getItem('eve_refresh_token');
        if (!refreshToken) {
            console.log('No refresh token available');
            return null;
        }

        console.log('🔄 Apollo: Refreshing access token...');
        const response = await fetch(
            process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: `
                        mutation RefreshToken($refreshToken: String!) {
                            refreshToken(refreshToken: $refreshToken) {
                                accessToken
                                refreshToken
                                expiresIn
                            }
                        }
                    `,
                    variables: { refreshToken },
                }),
            }
        );

        const result = await response.json();

        if (result.errors) {
            console.error('Token refresh error:', result.errors);
            return null;
        }

        const data = result.data.refreshToken;

        // Update tokens
        localStorage.setItem('eve_access_token', data.accessToken);
        if (data.refreshToken) {
            localStorage.setItem('eve_refresh_token', data.refreshToken);
        }
        const expiryTime = Date.now() + data.expiresIn * 1000;
        localStorage.setItem('eve_token_expiry', expiryTime.toString());

        console.log('✅ Apollo: Token refreshed successfully');
        return data.accessToken;
    } catch (error) {
        console.error('Error refreshing token:', error);
        return null;
    }
}

export function createApolloClient() {
    // Singleton pattern - reuse existing client if available
    if (apolloClient) {
        return apolloClient;
    }

    // HTTP Link for queries and mutations
    const httpLink = new HttpLink({
        uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql',
        credentials: 'same-origin',
    });

    // SSE Link - only available on client-side
    const sseLink = typeof window !== 'undefined'
        ? new SSELink({
            url: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql',
            headers: () => {
                const token = localStorage.getItem('eve_access_token');
                const sessionId = sessionStorage.getItem('session_id') ||
                    `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                if (!sessionStorage.getItem('session_id')) {
                    sessionStorage.setItem('session_id', sessionId);
                }

                console.log('🔑 SSELink: Getting headers, token exists:', !!token);
                return {
                    authorization: token ? `Bearer ${token}` : '',
                    'x-session-id': sessionId,
                };
            },
        })
        : null;

    console.log('🚀 Apollo Client: SSE Link initialized:', !!sseLink, 'window:', typeof window);

    // Auth link - adds Authorization header and session ID to every request
    const authLink = setContext((_, { headers }) => {
        const token = typeof window !== 'undefined'
            ? localStorage.getItem('eve_access_token')
            : null;

        // Generate or get session ID
        let sessionId = typeof window !== 'undefined'
            ? sessionStorage.getItem('session_id')
            : null;

        if (!sessionId && typeof window !== 'undefined') {
            sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            sessionStorage.setItem('session_id', sessionId);
        }

        return {
            headers: {
                ...headers,
                authorization: token ? `Bearer ${token}` : '',
                'x-session-id': sessionId || '',
            },
        };
    });

    // Error link - handles authentication errors and token refresh
    const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
        if (graphQLErrors) {
            for (const err of graphQLErrors) {
                // Check for authentication errors
                if (err.extensions?.code === 'UNAUTHENTICATED' ||
                    err.message.includes('Not authenticated') ||
                    err.message.includes('Unauthorized')) {

                    console.log('🔒 Authentication error detected, attempting token refresh...');

                    // Try to refresh the token
                    return new Observable((observer) => {
                        refreshAccessToken()
                            .then((newToken) => {
                                if (!newToken) {
                                    // Refresh failed, logout user
                                    console.log('❌ Token refresh failed, logging out...');
                                    localStorage.removeItem('eve_access_token');
                                    localStorage.removeItem('eve_refresh_token');
                                    localStorage.removeItem('eve_token_expiry');
                                    localStorage.removeItem('eve_user');
                                    window.dispatchEvent(new Event('auth-change'));
                                    observer.error(err);
                                    return;
                                }

                                // Retry the operation with new token
                                const oldHeaders = operation.getContext().headers;
                                operation.setContext({
                                    headers: {
                                        ...oldHeaders,
                                        authorization: `Bearer ${newToken}`,
                                    },
                                });

                                const subscriber = {
                                    next: observer.next.bind(observer),
                                    error: observer.error.bind(observer),
                                    complete: observer.complete.bind(observer),
                                };

                                // Retry the request
                                forward(operation).subscribe(subscriber);
                            })
                            .catch((error) => {
                                console.error('Error during token refresh:', error);
                                observer.error(error);
                            });
                    });
                }
            }
        }

        if (networkError) {
            console.error('🌐 Network error:', networkError);
        }
    });

    // Split link: SSE for subscriptions, HTTP for queries/mutations
    const splitLink = typeof window !== 'undefined' && sseLink
        ? split(
            ({ query }) => {
                const definition = getMainDefinition(query);
                return (
                    definition.kind === 'OperationDefinition' &&
                    definition.operation === 'subscription'
                );
            },
            sseLink,
            ApolloLink.from([errorLink, authLink, httpLink])
        )
        : ApolloLink.from([errorLink, authLink, httpLink]);

    apolloClient = new ApolloClient({
        link: splitLink,
        cache: new InMemoryCache(),
        defaultOptions: {
            watchQuery: {
                fetchPolicy: 'cache-and-network',
                errorPolicy: 'all',
            },
            query: {
                fetchPolicy: 'network-only',
                errorPolicy: 'all',
            },
        },
    });

    return apolloClient;
}

