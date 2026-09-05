/**
 * Merges the live-subscription buffer with the page the backend returned.
 *
 * Two things go wrong when the two lists are simply concatenated, and this
 * function exists for both.
 *
 * A killmail can be in both lists. The subscription pushes it the moment it
 * happens; the query returns it as soon as the query runs again. The buffer
 * dedupes against itself but knows nothing about the fetched page, so the
 * concatenation renders the same killmail twice — two React children with the
 * same key.
 *
 * And the concatenation has no ceiling. Page 1 is meant to be the newest
 * `limit` killmails, but every live arrival made it one row longer, forever,
 * while the reader sat on the page. Each row carries several images, links and
 * tooltips, so an hour of a busy feed is thousands of rows the browser has to
 * keep laid out. Capping at `limit` is also what keeps pagination honest: page
 * 2 still begins where an uncapped page 1 would have stopped, so anything past
 * the cap was going to be shown twice anyway.
 */
export function mergeRealtimeKillmails<T extends { id: string }>(
  buffered: readonly T[],
  fetched: readonly T[],
  limit: number,
): T[] {
  const alreadyFetched = new Set(fetched.map((km) => km.id));
  const merged = [
    ...buffered.filter((km) => !alreadyFetched.has(km.id)),
    ...fetched,
  ];
  return limit > 0 ? merged.slice(0, limit) : merged;
}

/**
 * Adds one live killmail to the buffer, newest first, ignoring one already
 * held. The buffer is capped for the same reason the merged list is: past
 * `limit` entries it can no longer affect what is rendered, so holding more
 * only costs memory.
 */
export function bufferRealtimeKillmail<T extends { id: string }>(
  buffered: readonly T[],
  killmail: T,
  limit: number,
): T[] {
  if (buffered.some((km) => km.id === killmail.id)) return buffered as T[];
  const next = [killmail, ...buffered];
  return limit > 0 ? next.slice(0, limit) : next;
}
