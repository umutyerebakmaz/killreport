import type { KillmailPage, KillmailRef } from './killmail-refs';

/**
 * The most pages one sync reads. The `char-killmail` and `corp-killmail`
 * groups allow 30 tokens per 15 minutes per character and a 2xx costs 2, so
 * 15 pages; one is left for the next sync.
 */
export const MAX_PAGES = 14;

export interface WalkResult {
  pages: number;
  found: number;
  inserted: number;
  capped: boolean;
}

/**
 * Read an authenticated killmail list page by page, recording each page as it
 * comes so that a failure later in the walk keeps what was already seen.
 *
 * Stops on a 404 (`null`) or an empty page, at ESI's X-Pages, after
 * `MAX_PAGES`, and — unless this is a full sync — on a page that added no new
 * ref: everything below it was recorded by an earlier sync, and filling gaps
 * is the publisher's job, not this walk's.
 */
export async function walkKillmails(
  fetchPage: (page: number) => Promise<KillmailPage | null>,
  record: (refs: KillmailRef[]) => Promise<number>,
  fullSync: boolean,
): Promise<WalkResult> {
  const result: WalkResult = { pages: 0, found: 0, inserted: 0, capped: false };

  for (let page = 1; page <= MAX_PAGES; page++) {
    const fetched = await fetchPage(page);
    if (fetched === null || fetched.refs.length === 0) return result;

    const inserted = await record(fetched.refs);
    result.pages = page;
    result.found += fetched.refs.length;
    result.inserted += inserted;

    if (!fullSync && inserted === 0) return result;
    if (fetched.pages !== null && page >= fetched.pages) return result;
  }

  result.capped = true;
  return result;
}
