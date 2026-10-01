import {
  buildDetailMessage,
  KILLMAIL_DETAIL_QUEUE,
} from '@services/killmail-detail-message';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getRabbitMQChannel } from '@services/rabbitmq';

export interface KillmailRef {
  killmail_id: number;
  killmail_hash: string;
}

export interface PublishOptions {
  announce: boolean;
  /** 1 for bulk backfill, 5 for live sync. */
  priority: number;
}

/**
 * How many ids to look up in a single query.
 *
 * `yarn sync:character <id> 999` lists ~199,800 killmails, and PostgreSQL's
 * extended protocol caps bind parameters at 65,535; Prisma does not split
 * them on its own. Asked as one `IN (…)`, the query is rejected and the
 * script dies without queueing anything.
 */
const LOOKUP_CHUNK = 5_000;

/**
 * The queueing step of the list stage.
 *
 * Ids already in the database are **not published**: CLAUDE.md's enrichment
 * pattern — read from the database, drop what is already resolved, queue only
 * what is missing. This reverses the old "fetch the detail first, then hit the
 * duplicate" order; re-syncing a character that is already stored comes down
 * to one query per page and fetches no ESI detail at all.
 */
export async function publishKillmailDetails(
  refs: KillmailRef[],
  options: PublishOptions,
): Promise<number> {
  if (refs.length === 0) return 0;

  const stored = new Set<number>();
  for (let i = 0; i < refs.length; i += LOOKUP_CHUNK) {
    const chunk = refs.slice(i, i + LOOKUP_CHUNK);
    const known = await prismaWorker.killmail.findMany({
      where: { killmail_id: { in: chunk.map((r) => r.killmail_id) } },
      select: { killmail_id: true },
    });
    for (const row of known) stored.add(row.killmail_id);
  }

  const missing = refs.filter((r) => !stored.has(r.killmail_id));
  if (missing.length === 0) return 0;

  const channel = await getRabbitMQChannel();
  for (const ref of missing) {
    channel.sendToQueue(
      KILLMAIL_DETAIL_QUEUE,
      Buffer.from(
        JSON.stringify(
          buildDetailMessage(
            ref.killmail_id,
            ref.killmail_hash,
            options.announce,
          ),
        ),
      ),
      { persistent: true, priority: options.priority },
    );
  }

  logger.debug(
    `📤 queued ${missing.length}/${refs.length} killmail(s) for detail fetch`,
  );
  return missing.length;
}
