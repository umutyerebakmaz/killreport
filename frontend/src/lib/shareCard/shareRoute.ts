import {
  ShareAllianceDocument,
  ShareCharacterDocument,
  ShareCorporationDocument,
  ShareKillmailDocument,
  ShareSolarSystemDocument,
  type ShareAllianceQuery,
  type ShareCharacterQuery,
  type ShareCorporationQuery,
  type ShareKillmailQuery,
  type ShareSolarSystemQuery,
} from '@/generated/graphql';
import type { DocumentNode } from 'graphql';
import type { Metadata } from 'next';
import {
  toShareAlliance,
  toShareCharacter,
  toShareCorporation,
} from './entityShare';
import { fetchGraphQL } from './fetchGraphQL';
import { hasVictim } from './killmailShare';
import { toShareSolarSystem } from './solarSystemShare';

type Params = Promise<{ id: string }>;

/**
 * Data-cache lifetime for the metadata fetch in the share layouts. Short on
 * purpose: it only spares the backend a burst (a crawler reads the page and
 * then the image within seconds), and an errored 200 the data cache stored
 * can hold the generic metadata for no longer than this.
 */
export const SHARE_METADATA_REVALIDATE = 60;

/**
 * Data-cache lifetime for the image routes' fetch: none. The image route is
 * ISR and caches its own response, so the data cache would only add a second
 * place for a bad body to be kept.
 */
export const SHARE_IMAGE_FETCH_REVALIDATE = 0;

/**
 * The largest id there can be: GraphQL `Int` and the `integer` id columns are
 * both 32-bit, so a bigger id cannot name an entity, and sending it makes the
 * backend answer with an error rather than with null.
 */
const MAX_ID = 2_147_483_647;

/** Positive 32-bit integers only; anything else is a missing entity, not a query. */
export function parseShareId(raw: string): number | null {
  if (!/^\d{1,10}$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 && id <= MAX_ID ? id : null;
}

/**
 * Parses the route id and loads the card's data. Resolves to the entity, or
 * to null when the id is malformed or the backend cleanly answers that there
 * is no such entity. Throws when the backend fails, so the caller can tell a
 * missing entity (404) from an outage (error, never cached).
 */
async function loadShare<TData, TVars, T>(
  params: Params,
  doc: DocumentNode,
  variables: (id: number) => TVars,
  pick: (id: number, data: TData) => T | null,
  revalidate: number,
): Promise<T | null> {
  const id = parseShareId((await params).id);
  if (id == null) return null;
  const data = await fetchGraphQL<TData, TVars>(doc, variables(id), revalidate);
  return pick(id, data);
}

export const loadKillmailShare = (params: Params, revalidate: number) =>
  loadShare(
    params,
    ShareKillmailDocument,
    (id) => ({ id: String(id) }),
    (_, data: ShareKillmailQuery) =>
      hasVictim(data.killmail) ? data.killmail : null,
    revalidate,
  );

export const loadCharacterShare = (params: Params, revalidate: number) =>
  loadShare(
    params,
    ShareCharacterDocument,
    (id) => ({ id }),
    (id, data: ShareCharacterQuery) => toShareCharacter(id, data),
    revalidate,
  );

export const loadCorporationShare = (params: Params, revalidate: number) =>
  loadShare(
    params,
    ShareCorporationDocument,
    (id) => ({ id }),
    (id, data: ShareCorporationQuery) => toShareCorporation(id, data),
    revalidate,
  );

export const loadAllianceShare = (params: Params, revalidate: number) =>
  loadShare(
    params,
    ShareAllianceDocument,
    (id) => ({ id }),
    (id, data: ShareAllianceQuery) => toShareAlliance(id, data),
    revalidate,
  );

export const loadSolarSystemShare = (params: Params, revalidate: number) =>
  loadShare(
    params,
    ShareSolarSystemDocument,
    (id) => ({ id }),
    (_, data: ShareSolarSystemQuery) => toShareSolarSystem(data),
    revalidate,
  );

/** The image route's answer for a missing entity. */
export const shareNotFound = () => new Response(null, { status: 404 });

/**
 * `generateMetadata` for a share route. A missing entity keeps the generic
 * metadata, and so does a backend failure: the layout only adds metadata and
 * must never break the page (spec, decision 4). The failure is logged so it
 * is not silent.
 */
export async function shareMetadata<T>(
  load: () => Promise<T | null>,
  text: (value: T) => { title: string; description: string },
): Promise<Metadata> {
  let value: T | null;
  try {
    value = await load();
  } catch (error) {
    console.error('Share metadata fell back to the defaults:', error);
    return {};
  }
  if (value == null) return {};
  const { title, description } = text(value);
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: 'summary_large_image' },
  };
}
