import { ApolloClient, ApolloLink, HttpLink, InMemoryCache, Observable, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getMainDefinition } from '@apollo/client/utilities';
import { ClientOptions, createClient } from 'graphql-sse';

// HTTP Link for queries and mutations
const httpLink = new HttpLink({
    uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql',
    credentials: 'same-origin',
});

// SSE Link for subscriptions using graphql-sse
class SSELink extends ApolloLink {
    private client: ReturnType<typeof createClient>;

    constructor(options: ClientOptions) {
        super();
        this.client = createClient(options);
    }

    request(operation: any) {
        return new Observable((observer) => {
            return this.client.subscribe(
                { ...operation, query: operation.query.loc?.source.body || '' },
                {
                    next: observer.next.bind(observer),
                    complete: observer.complete.bind(observer),
                    error: observer.error.bind(observer),
                }
            );
        });
    }
}

const sseLink = typeof window !== 'undefined'
    ? new SSELink({
        url: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql',
        headers: () => {
            const token = localStorage.getItem('eve_access_token');
            return {
                authorization: token ? `Bearer ${token}` : '',
            };
        },
    })
    : null;

// Auth link - her request'e Authorization header ekler
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

// Split link: subscription için SSE, diğerleri için HTTP
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

const apolloClient = new ApolloClient({
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

export default apolloClient;

