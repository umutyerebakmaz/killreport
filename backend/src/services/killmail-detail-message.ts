/**
 * The message carried by `esi_killmail_detail_queue`.
 *
 * It names a killmail and says nothing else. The detail endpoint
 * (`/killmails/{id}/{hash}/`) is public, so the worker needs no token; the
 * list call that does need one stays with the publisher (#238).
 *
 * `announce` carries a policy, not an identity: the publisher decides whether
 * to announce (bulk backfill does not), but the worker makes the call.
 */
export const KILLMAIL_DETAIL_QUEUE = 'esi_killmail_detail_queue';

export interface KillmailDetailMessage {
  killmailId: number;
  killmailHash: string;
  announce: boolean;
}

export function buildDetailMessage(
  killmailId: number,
  killmailHash: string,
  announce: boolean,
): KillmailDetailMessage {
  return { killmailId, killmailHash, announce };
}
