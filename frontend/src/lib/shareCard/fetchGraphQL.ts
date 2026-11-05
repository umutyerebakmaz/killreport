import type { DocumentNode } from 'graphql';
import { print } from 'graphql';

const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql';

/**
 * How long a share card waits for the backend. The backend answers these
 * queries from Redis in milliseconds; a request still open after 10 s is a
 * stuck backend, and the crawlers that ask for share cards (Discord, X) give
 * up at about the same point, so waiting longer only holds a render open.
 */
export const SHARE_FETCH_TIMEOUT_MS = 10_000;

/**
 * Server-side GraphQL call for share cards. Returns `data`, and throws on a
 * network error, a timeout, a non-OK status, a GraphQL `errors` array or a
 * body without `data`, so a backend failure is never mistaken for a missing
 * entity (which the routes answer with a cached 404).
 *
 * `revalidate` is the Next data-cache lifetime; 0 keeps the response out of the
 * data cache entirely. Never `false`: Yoga reports resolver errors with HTTP
 * 200, and the data cache stores any 200 before this function can look at it.
 */
export async function fetchGraphQL<TData, TVars>(
  doc: DocumentNode,
  variables: TVars,
  revalidate: number,
): Promise<TData> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: print(doc), variables }),
    next: { revalidate },
    signal: AbortSignal.timeout(SHARE_FETCH_TIMEOUT_MS),
  });
  if (!res.ok)
    throw new Error(`GraphQL request failed with HTTP ${res.status}`);
  const json = (await res.json()) as {
    data?: TData | null;
    errors?: { message?: string }[];
  };
  if (json.errors?.length) {
    const messages = json.errors.map((e) => e.message).join('; ');
    throw new Error(`GraphQL errors: ${messages}`);
  }
  if (json.data == null) throw new Error('GraphQL response has no data');
  return json.data;
}
