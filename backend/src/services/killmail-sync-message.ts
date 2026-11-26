/**
 * The message both killmail sync queues carry: `esi_user_killmails_queue` and
 * `esi_corporation_killmails_queue`.
 *
 * It names a user and says nothing else. The worker reads the character, the
 * corporation and a valid access token from the database, because all of it
 * is already there and the message's copy could only ever be a staler
 * version of it.
 */
export interface KillmailSyncMessage {
  userId: number;
  /** `--full`: walk every page instead of stopping on a known one. */
  fullSync?: boolean;
  queuedAt: string;
}

/**
 * Whether a sync walks every page instead of stopping on the first page whose
 * refs are all already in `killmail_refs` (`killmail-walk.ts`).
 *
 * Always true for a user who has never synced (`lastSyncedAt` null): another
 * user's or the corporation's sync may already have recorded the newest
 * killmails, and stopping there would leave this user's history unread.
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
