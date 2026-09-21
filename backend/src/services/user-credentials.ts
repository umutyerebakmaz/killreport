import { refreshAccessToken } from '@services/eve-sso';
import logger from '@services/logger';

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
  | { ok: true; user: UserSyncRow; accessToken: string; expiresAt: Date }
  | { ok: false; reason: 'not-found' | 'no-refresh-token' | 'refresh-failed' };

/**
 * The two Prisma clients are not interchangeable: workers use
 * `@services/prisma-worker` and the API uses `@services/prisma`, because
 * DigitalOcean PostgreSQL allows 22 connections and sharing one pool exhausts
 * it. Both call this function, so the caller passes its own client rather than
 * the module picking one.
 */
export interface CredentialClient {
  user: {
    findUnique: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
}

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
 *
 * Two things this function does not do. Concurrent refresh is not serialised:
 * if two workers hit the same user while its token is expiring, both call
 * `refreshAccessToken` with the same rotating refresh token, and the loser
 * gets `invalid_grant` back and acks its message with `refresh-failed`. Not a
 * regression — the per-message code this replaced raced the same way — and
 * rare today because only the character worker runs under PM2
 * (`ecosystem.config.js`); putting the corporation worker under PM2 too is
 * what would make a row lock or a short Redis lock worth adding. And a
 * persist failure after a successful refresh is unrecoverable: the
 * `client.user.update` below sits inside the same `try` as the refresh
 * call, so a transient database error there returns `refresh-failed` while
 * EVE has already rotated the token and the stored `refresh_token` is the
 * consumed one — every later refresh fails until the user logs in again. A
 * narrow window, and the same shape as the code it replaced.
 */
export async function loadUserCredentials(
  userId: number,
  client: CredentialClient,
): Promise<UserCredentials> {
  const row = await client.user.findUnique({
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
    return { ok: true, user, accessToken: access_token, expiresAt: expires_at };
  }

  try {
    const fresh = await refreshAccessToken(refresh_token);
    const freshExpiresAt = new Date(Date.now() + fresh.expires_in * 1000);

    await client.user.update({
      where: { id: userId },
      data: {
        access_token: fresh.access_token,
        refresh_token: fresh.refresh_token ?? refresh_token,
        expires_at: freshExpiresAt,
      },
    });

    return {
      ok: true,
      user,
      accessToken: fresh.access_token,
      expiresAt: freshExpiresAt,
    };
  } catch (error) {
    logger.error(`Token refresh failed for user ${userId}`, { error });
    return { ok: false, reason: 'refresh-failed' };
  }
}
