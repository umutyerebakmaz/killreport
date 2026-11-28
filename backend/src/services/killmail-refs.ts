import { utcTimestamp } from '@helpers/utc-timestamp';
import prismaWorker from '@services/prisma-worker';

/**
 * `killmail_refs`: every killmail a user or corporation sync has seen on ESI
 * (and every one the R2Z2 stream could not write itself),
 * the durable record of work RabbitMQ only carries. A ref with no row in
 * `killmails` is pending; `queue-killmail-refs` publishes those to the detail
 * queue until they are written. See
 * docs/superpowers/specs/2026-11-26-killmail-refs-sync-design.md.
 */

export type RefSource = 'character' | 'corporation' | 'redisq';

export interface KillmailRef {
  killmail_id: number;
  killmail_hash: string;
}

/** One page of an authenticated killmail list. `pages` is ESI's X-Pages. */
export interface KillmailPage {
  refs: KillmailRef[];
  pages: number | null;
}

/**
 * Record one page in one statement and return how many refs were new. The
 * first sync to see a killmail keeps its row; later ones change nothing.
 */
export async function recordRefs(
  refs: KillmailRef[],
  source: RefSource,
  now: Date,
): Promise<number> {
  if (refs.length === 0) return 0;
  const inserted = await prismaWorker.$queryRaw<{ killmail_id: number }[]>`
    INSERT INTO killmail_refs (killmail_id, killmail_hash, source, discovered_at)
    SELECT id, hash, ${source}, ${utcTimestamp(now)}::timestamp
    FROM UNNEST(${refs.map((r) => r.killmail_id)}::int[], ${refs.map((r) => r.killmail_hash)}::text[]) AS t(id, hash)
    ON CONFLICT (killmail_id) DO NOTHING
    RETURNING killmail_id
  `;
  return inserted.length;
}
