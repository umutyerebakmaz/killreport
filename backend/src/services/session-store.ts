import { createHash, randomBytes } from 'crypto';

import prisma from '@services/prisma';
import { sessionState, slidExpiry } from '@services/session';

/**
 * Session rows, and the token that points at one.
 *
 * The cookie carries 32 random bytes; the table stores only their SHA-256.
 * A database leak therefore yields nothing usable — the values in `token_hash`
 * cannot be presented as cookies. This is why there is no signature: once a row
 * grants the authority, a signature adds a second secret to lose.
 */

export interface SessionRow {
  id: string;
  created_at: Date;
  last_seen_at: Date;
  expires_at: Date;
  user_agent: string | null;
  ip: string | null;
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  userId: number,
  meta: { userAgent?: string | null; ip?: string | null },
): Promise<string> {
  const token = newSessionToken();

  await prisma.session.create({
    data: {
      token_hash: hashSessionToken(token),
      user_id: userId,
      expires_at: slidExpiry(new Date()),
      user_agent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
    },
  });

  return token;
}

/**
 * The session this token names, sliding its lifetime as a side effect.
 *
 * Returns null for every unusable case — absent, unknown, revoked, expired —
 * because the caller does the same thing with all four: answer
 * `UNAUTHENTICATED`. Distinguishing them in the response would tell an attacker
 * whether a token ever existed.
 */
export async function resolveSession(
  token: string | undefined,
): Promise<{ id: string; userId: number } | null> {
  if (!token) return null;

  const row = await prisma.session.findUnique({
    where: { token_hash: hashSessionToken(token) },
    select: { id: true, user_id: true, expires_at: true, revoked_at: true },
  });

  if (sessionState(row, new Date()) !== 'valid') return null;

  const now = new Date();
  await prisma.session.update({
    where: { id: row!.id },
    data: { last_seen_at: now, expires_at: slidExpiry(now) },
  });

  return { id: row!.id, userId: row!.user_id };
}

/** Scoped to the owner: another user's id simply revokes nothing. */
export async function revokeSessionById(
  id: string,
  userId: number,
): Promise<boolean> {
  const { count } = await prisma.session.updateMany({
    where: { id, user_id: userId, revoked_at: null },
    data: { revoked_at: new Date() },
  });

  return count > 0;
}

export async function revokeSessionByToken(token: string): Promise<void> {
  await prisma.session.updateMany({
    where: { token_hash: hashSessionToken(token), revoked_at: null },
    data: { revoked_at: new Date() },
  });
}

export async function listSessions(userId: number): Promise<SessionRow[]> {
  return prisma.session.findMany({
    where: { user_id: userId, revoked_at: null },
    select: {
      id: true,
      created_at: true,
      last_seen_at: true,
      expires_at: true,
      user_agent: true,
      ip: true,
    },
    orderBy: { last_seen_at: 'desc' },
  });
}
