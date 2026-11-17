/**
 * The message both killmail sync queues carry: `esi_user_killmails_queue` and
 * `esi_corporation_killmails_queue`.
 *
 * It names a user and says nothing else. The worker reads the character, the
 * corporation, the last synced killmail and a valid access token from the
 * database through `loadUserCredentials`, because all of it is already there
 * and the message's copy could only ever be a staler version of it.
 */
export interface KillmailSyncMessage {
  userId: number;
  /** `--full`: ignore last_killmail_id and fetch from scratch. */
  fullSync?: boolean;
  queuedAt: string;
}

/**
 * Whether a sync should ignore the incremental cursor.
 *
 * Always true for a user who has never synced (`lastSyncedAt` null). The
 * cursor is MAX(killmail_id) over `killmail_filters`, and every writer feeds
 * that table — RedisQ writes all of EVE. So a new user usually has a killmail
 * in the database already, the ESI list stops on it at the first row, and the
 * history is never fetched (see `killmail-cursor.ts`).
 *
 * The cron and both manual queue scripts decide through this one function, so
 * the rule cannot hold in one publisher and be missing from another.
 */
export function isFullSync(
  lastSyncedAt: Date | null,
  requested: boolean,
): boolean {
  return requested || lastSyncedAt === null;
}

export function buildSyncMessage(
  userId: number,
  fullSync = false,
): KillmailSyncMessage {
  return {
    userId,
    ...(fullSync ? { fullSync: true } : {}),
    queuedAt: new Date().toISOString(),
  };
}
