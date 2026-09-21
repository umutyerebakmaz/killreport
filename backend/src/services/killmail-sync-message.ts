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
