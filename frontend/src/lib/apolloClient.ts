import { ApolloClient, ApolloLink, HttpLink, InMemoryCache, Observable, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getMainDefinition } from '@apollo/client/utilities';
import { ClientOptions, createClient } from 'graphql-sse';

// SSE Link for subscriptions using graphql-sse
class SSELink extends ApolloLink {
    private client: ReturnType<typeof createClient>;

    constructor(options: ClientOptions) {
        super();
        this.client = createClient(options);
    }

    request(operation: any) {
        console.log('🔌 SSELink: Subscribing to operation:', operation.operationName);
        return new Observable((observer) => {
            return this.client.subscribe(
                { ...operation, query: operation.query.loc?.source.body || '' },
                {
                    next: (data) => {
                        console.log('📨 SSELink: Received data for', operation.operationName, data);
                        observer.next(data);
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
                console.log('🔑 SSELink: Getting headers, token exists:', !!token);
                return {
                    authorization: token ? `Bearer ${token}` : '',
                };
            },
        })
        : null;

    console.log('🚀 Apollo Client: SSE Link initialized:', !!sseLink, 'window:', typeof window);

    // Auth link - adds Authorization header to every request
    const authLink = setContext((_, { headers }) => {
        const token = typeof window !== 'undefined'
            ? localStorage.getItem('eve_access_token')
            : null;

        return {
            headers: {
                ...headers,
                authorization: token ? `Bearer ${token}` : '',
            },
        };
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
            authLink.concat(httpLink)
        )
        : authLink.concat(httpLink);

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

