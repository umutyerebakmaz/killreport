import { refreshAccessToken } from '@services/eve-sso';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';

/**
 * Tokens live in `users` and nowhere else.
 *
 * They used to ride inside the queue message, which put a refresh token on the
 * broker's disk once per publish and kept a copy in `killreport.parking`
 * forever. It was also wrong in a quieter way: EVE rotates the refresh token,
 * the worker writes the new one here, and every message still holding the old
 * snapshot then failed to refresh and acked its user out of sync entirely.
 *
 * So a sync message names a user and this module answers with a token that is
 * valid right now.
 */

/** The five minute buffer the publishers have always used. */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** Everything a sync worker needs about a user, minus the credentials. */
export interface UserSyncRow {
  id: number;
  character_id: number;
  character_name: string;
  corporation_id: number | null;
  last_killmail_id: number | null;
  last_corp_killmail_id: number | null;
}

export type UserCredentials =
  | { ok: true; user: UserSyncRow; accessToken: string }
  | { ok: false; reason: 'not-found' | 'no-refresh-token' | 'refresh-failed' };

/**
 * True when the token is gone or close enough to gone that the ESI calls
 * following this check would run out mid-sync.
 */
export function needsRefresh(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime() + REFRESH_BUFFER_MS;
}

/**
 * A valid access token for `userId`, refreshing and persisting first if needed.
 *
 * Returns a reason rather than throwing: none of the three failures is worth a
 * retry, because no number of attempts fixes a user who has to log in again.
 * Routing them through `handleWorkerError` would requeue work that can never
 * succeed, which is the contract #234 set up.
 */
export async function loadUserCredentials(
  userId: number,
): Promise<UserCredentials> {
  const row = await prismaWorker.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      character_id: true,
      character_name: true,
      corporation_id: true,
      last_killmail_id: true,
      last_corp_killmail_id: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
    },
  });

  if (!row) return { ok: false, reason: 'not-found' };
  if (!row.refresh_token) return { ok: false, reason: 'no-refresh-token' };

  const { access_token, refresh_token, expires_at, ...user } = row;

  if (!needsRefresh(expires_at, new Date())) {
    return { ok: true, user, accessToken: access_token };
  }

  try {
    const fresh = await refreshAccessToken(refresh_token);

    await prismaWorker.user.update({
      where: { id: userId },
      data: {
        access_token: fresh.access_token,
        refresh_token: fresh.refresh_token ?? refresh_token,
        expires_at: new Date(Date.now() + fresh.expires_in * 1000),
      },
    });

    return { ok: true, user, accessToken: fresh.access_token };
  } catch (error) {
    logger.error(`Token refresh failed for user ${userId}`, { error });
    return { ok: false, reason: 'refresh-failed' };
  }
}
