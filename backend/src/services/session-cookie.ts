/**
 * The session cookie, as a string.
 *
 * Nothing here reads the database or the request — the header in, the header
 * out. That keeps the import graph free of `config.ts`, whose `parseEnv` calls
 * `process.exit(1)` when a variable is missing: CI has no `.env`, so a spec
 * that reaches config dies before its first assertion. #237 moved a decision
 * function for exactly this reason.
 */

export const SESSION_COOKIE_NAME = 'kr_session';

/** 30 days, matching the sliding session lifetime. */
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * `Cookie: a=1; b=2` into an object.
 *
 * A pair with no `=` is skipped rather than throwing: this parses input from
 * the network, and one malformed cookie set by anything else on the host must
 * not take the request down.
 */
export function parseCookieHeader(
  header: string | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;

  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;

    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!name) continue;

    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }

  return out;
}

/**
 * `SameSite=Lax` is enough in both environments and `None` is not needed:
 * SameSite looks at the registrable domain, not the origin, so
 * `killreport.com` and `api.killreport.com` are the same site, and in
 * development both ends are `localhost` (cookies ignore the port). It is also
 * the CSRF answer — a cross-site POST carries no cookie, and GraphQL's
 * `application/json` POST is preflighted, so CORS stops it too.
 *
 * No `Domain`, so the cookie is host-only: in production only
 * `api.killreport.com` ever receives it.
 */
export function serializeSessionCookie(
  value: string,
  opts: { secure: boolean },
): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${MAX_AGE_SECONDS}`,
  ];

  if (opts.secure) parts.push('Secure');

  return parts.join('; ');
}

/** The same cookie with a zero lifetime, which is how a browser is told to drop it. */
export function clearSessionCookie(opts: { secure: boolean }): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=0',
  ];

  if (opts.secure) parts.push('Secure');

  return parts.join('; ');
}
