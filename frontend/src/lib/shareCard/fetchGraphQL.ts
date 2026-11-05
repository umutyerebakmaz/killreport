import type { DocumentNode } from 'graphql';
import { print } from 'graphql';

const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql';

/**
 * Server-side GraphQL call for share cards. Returns `data`, or `null` on an
 * HTTP error, a network error or a GraphQL `errors` array.
 */
export async function fetchGraphQL<TData, TVars>(
  doc: DocumentNode,
  variables: TVars,
  revalidate: number | false,
): Promise<TData | null> {
  try {
    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: print(doc), variables }),
      next: { revalidate },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: TData; errors?: unknown[] };
    if (json.errors?.length) return null;
    return json.data ?? null;
  } catch {
    return null;
  }
}
