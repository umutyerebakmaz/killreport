import { refreshAccessToken, SsoGrantRevokedError } from '@services/eve-sso';
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
 * valid right now. The Rust `sso` crate follows the same steps; see
 * docs/superpowers/specs/2026-11-26-killmail-refs-sync-design.md.
 */

/** The five minute buffer the publishers have always used. */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * How long the refresh transaction may hold the row lock: the SSO request's
 * own 10 s timeout plus room for the two statements around it.
 */
const REFRESH_TRANSACTION_MS = 15_000;

/** Everything a sync worker needs about a user, minus the credentials. */
export interface UserSyncRow {
  id: number;
  character_id: number;
  character_name: string;
  corporation_id: number | null;
  last_killmail_id: number | null;
  last_corp_killmail_id: number | null;
  last_killmail_sync_at: Date | null;
  last_corp_killmail_sync_at: Date | null;
  email: string | null;
  created_at: Date;
}

/**
 * `token-revoked`: SSO answered `invalid_grant`, the stored refresh token has
 * been cleared and the user has to log in again. A transient SSO failure is
 * not a reason here: it throws, so the caller retries.
 */
export type UserCredentials =
  | { ok: true; user: UserSyncRow; accessToken: string; expiresAt: Date }
  | { ok: false; reason: 'not-found' | 'no-refresh-token' | 'token-revoked' };

interface TokenRow {
  access_token: string;
  refresh_token: string | null;
  expires_at: Date;
}

/**
 * The two Prisma clients are not interchangeable: workers use
 * `@services/prisma-worker` and the API uses `@services/prisma`, because
 * each process type gets a pool sized for its own work. Both call this
 * function, so the caller passes its own client rather than
 * the module picking one.
 */
export interface CredentialClient {
  user: { findUnique: (args: any) => Promise<any> };
  $transaction: (fn: (tx: any) => Promise<any>, options?: any) => Promise<any>;
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
 * A token that is still good is read without a lock. One that needs a refresh
 * is refreshed inside a transaction holding the user row `FOR UPDATE`: the
 * cron publishes the character and the corporation sync of a user together,
 * and without the lock both workers would send the same rotating refresh
 * token, the loser would get `invalid_grant` and treat a live grant as dead.
 * With it the second one waits, re-reads, finds the token fresh and leaves
 * SSO alone. The write is also a compare-and-swap on the old refresh token,
 * for any writer that does not take the lock.
 *
 * `invalid_grant` clears the refresh token under the same lock and reports
 * `token-revoked`; the cron stops selecting the user until they log in again.
 * Any other SSO failure throws (`SsoUnavailableError`) and leaves the row
 * alone, so a worker retries through `handleWorkerError` and the API answers
 * with an error instead of logging the user out.
 *
 * One window remains: if the database write fails after EVE has rotated the
 * token, the transaction rolls back and the stored refresh token is the
 * consumed one. Nothing on our side can close that.
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
      last_killmail_sync_at: true,
      last_corp_killmail_sync_at: true,
      email: true,
      created_at: true,
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

  return client.$transaction(
    async (tx): Promise<UserCredentials> => {
      const [locked] = (await tx.$queryRaw`
        SELECT access_token, refresh_token, expires_at
        FROM users WHERE id = ${userId}
        FOR UPDATE
      `) as TokenRow[];

      if (!locked) return { ok: false, reason: 'not-found' };
      if (!locked.refresh_token) {
        return { ok: false, reason: 'no-refresh-token' };
      }
      if (!needsRefresh(locked.expires_at, new Date())) {
        // Another process refreshed it while this one waited for the lock.
        return {
          ok: true,
          user,
          accessToken: locked.access_token,
          expiresAt: locked.expires_at,
        };
      }

      let fresh: Awaited<ReturnType<typeof refreshAccessToken>>;
      try {
        fresh = await refreshAccessToken(locked.refresh_token);
      } catch (error) {
        if (error instanceof SsoGrantRevokedError) {
          await tx.user.updateMany({
            where: { id: userId, refresh_token: locked.refresh_token },
            data: { refresh_token: null },
          });
          logger.warn(
            `refresh token of user ${userId} was revoked; cleared until the next login`,
          );
          return { ok: false, reason: 'token-revoked' };
        }
        throw error;
      }

      const freshExpiresAt = new Date(Date.now() + fresh.expires_in * 1000);
      await tx.user.updateMany({
        where: { id: userId, refresh_token: locked.refresh_token },
        data: {
          access_token: fresh.access_token,
          refresh_token: fresh.refresh_token ?? locked.refresh_token,
          expires_at: freshExpiresAt,
        },
      });

      return {
        ok: true,
        user,
        accessToken: fresh.access_token,
        expiresAt: freshExpiresAt,
      };
    },
    { timeout: REFRESH_TRANSACTION_MS },
  );
}
