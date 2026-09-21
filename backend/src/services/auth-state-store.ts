import { randomUUID } from 'crypto';

import logger from '@services/logger';
import redis from '@services/redis';

/**
 * The `state` parameter of the EVE SSO round trip, and the page the user left.
 *
 * `state` used to be a UUID that was minted, sent to EVE and read back without
 * ever being written down, so the callback accepted any value that was merely
 * present - the CSRF protection the schema advertises did not exist. Giving the
 * value a home fixes that and answers "where was the user?" at the same time:
 * the key IS the state, the value IS the path to return to, and a callback
 * whose state is not in the store is refused before a code is ever exchanged.
 *
 * The read is single-use - the GET and the DEL go out in one MULTI - so a
 * callback URL replayed from history or a log cannot mint a second session.
 */

export const AUTH_STATE_TTL_SECONDS = 600;

const MAX_RETURN_TO_LENGTH = 512;

const key = (state: string) => `auth:state:${state}`;

/**
 * Reduce a caller-supplied return path to something safe to put in a
 * `Location` header, or to `/`.
 *
 * Only a site-relative path survives. Everything else is an open redirect
 * waiting to happen: `//evil.example` and `/\evil.example` are read by browsers
 * as hosts, and an absolute URL needs no explanation. The auth routes are
 * excluded because they are machinery rather than destinations - returning to
 * one restarts the dance with a state that has just been consumed.
 */
export function sanitizeReturnTo(raw: string | null | undefined): string {
  if (!raw) return '/';
  if (raw.length > MAX_RETURN_TO_LENGTH) return '/';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return '/';
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  if (raw === '/auth' || raw.startsWith('/auth/')) return '/';

  return raw;
}

/**
 * Mint a state for an outgoing SSO redirect and remember where to come back to.
 *
 * The state is generated here rather than by the caller so that no code path
 * can send EVE a state the store has never heard of.
 */
export async function createAuthState(returnTo: string): Promise<string> {
  const state = randomUUID();

  await redis.setex(key(state), AUTH_STATE_TTL_SECONDS, returnTo);

  return state;
}

/**
 * Spend a state and get its return path back, or `null` if the state is
 * unknown, expired, already spent, or unreadable.
 *
 * GET and DEL travel in one MULTI rather than as `GETDEL`, which only exists
 * from Redis 6.2 and is not a command every deployment answers - a server on
 * 6.0 replies `ERR unknown command`, and an error here means nobody can log
 * in. MULTI is as atomic and as old as Redis itself.
 *
 * Redis being unreachable must not be a way to break the site either, so a
 * failure is a refused login rather than a thrown error: the caller is an HTTP
 * handler whose rejection would take the process with it.
 *
 * The path is sanitised again on the way out: it is about to become a
 * `Location` header, and the store is not the only thing that could ever have
 * written to it.
 */
export async function consumeAuthState(
  state: string | null | undefined,
): Promise<string | null> {
  if (!state) return null;

  let results: [Error | null, unknown][] | null;
  try {
    results = await redis.multi().get(key(state)).del(key(state)).exec();
  } catch (error) {
    logger.error('Could not read the auth state from Redis:', error);
    return null;
  }

  // `exec` returns null when the transaction was discarded, and each entry is
  // an [error, value] pair.
  const get = results?.[0];
  if (!get || get[0] !== null) return null;
  if (typeof get[1] !== 'string') return null;

  return sanitizeReturnTo(get[1]);
}
