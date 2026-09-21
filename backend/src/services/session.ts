/**
 * What a session row means right now.
 *
 * Kept apart from the database calls so the rules are readable and testable on
 * their own: a row is usable only when it exists, was not revoked, and has not
 * run out. Revocation is reported ahead of expiry because it is the deliberate
 * act — "this device was signed out" is a more useful answer than "it lapsed".
 */

/** 30 days. The session slides: every successful use pushes it out again. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionRowState = 'valid' | 'expired' | 'revoked' | 'missing';

export function sessionState(
  row: { expires_at: Date; revoked_at: Date | null } | null,
  now: Date,
): SessionRowState {
  if (!row) return 'missing';
  if (row.revoked_at) return 'revoked';
  if (row.expires_at.getTime() <= now.getTime()) return 'expired';
  return 'valid';
}

export function slidExpiry(now: Date): Date {
  return new Date(now.getTime() + SESSION_TTL_MS);
}
