/**
 * EVE SSO Authentication Callback Handler
 */

import { config } from '@config/config';
import { IncomingMessage, ServerResponse } from 'http';
import { consumeAuthState } from '@services/auth-state-store';
import { exchangeCodeForToken, verifyToken } from '@services/eve-sso';
import logger from '@services/logger';
import prisma from '@services/prisma';
import { createSession } from '@services/session-store';
import { serializeSessionCookie } from '@services/session-cookie';

/**
 * Where the browser goes next.
 *
 * Both outcomes end in a redirect to a real page of the application. There is
 * no interstitial: an "Authentication Successful!" card the user reads for half
 * a second is half a second of a page that is not the site, and the error case
 * used to be worse still - a raw JSON body rendered in the browser.
 *
 * `returnTo` has already been through `sanitizeReturnTo`, so resolving it
 * against the frontend origin cannot leave the site.
 */
function frontendLocation(returnTo: string, login: '1' | 'error'): string {
  const target = new URL(returnTo, config.eveSso.frontendUrl);
  target.searchParams.set('login', login);
  return target.toString();
}

/**
 * Handle EVE SSO callback after user authorizes
 */
export async function handleAuthCallback(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // Everything below runs inside the try. This handler is the `await`ed body of
  // the HTTP server's request listener, so anything it lets escape becomes an
  // unhandled rejection and takes the whole process with it - one malformed
  // callback would stop the API for everyone.
  let returnTo = '/';

  try {
    // The state is spent first, before a code is exchanged for anything. A
    // state the store has never issued - or has already seen once - means this
    // callback did not start here, and the rest of the handler has no business
    // running.
    const stored = await consumeAuthState(state);

    if (stored === null) {
      logger.warn('Auth callback rejected: unknown, expired or replayed state');
      res.writeHead(302, { Location: frontendLocation('/', 'error') });
      res.end();
      return;
    }

    returnTo = stored;

    if (!code) {
      logger.warn('Auth callback rejected: missing code parameter');
      res.writeHead(302, { Location: frontendLocation(returnTo, 'error') });
      res.end();
      return;
    }

    // Exchange authorization code for access token
    logger.debug('Exchanging code for token...');
    const tokenData = await exchangeCodeForToken(code);

    // Verify token and get character info
    logger.debug('Verifying token...');
    const character = await verifyToken(tokenData.access_token);
    logger.info(
      `✅ User authenticated: ${character.characterName} (${character.characterId})`,
    );

    // Calculate token expiry time
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // Find or create user in database
    const user = await prisma.user.upsert({
      where: { character_id: character.characterId },
      update: {
        character_name: character.characterName,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
      },
      create: {
        character_id: character.characterId,
        character_name: character.characterName,
        character_owner_hash: character.characterOwnerHash,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
      },
    });

    logger.debug(`User ${user.character_name} saved to database`);

    // The redirect used to carry the token pair in its query string, which
    // wrote a refresh token into whatever serves the frontend, its access log
    // and the user's browser history. Nothing travels in the URL now: the
    // browser leaves with a cookie and asks for an access token separately.
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded)
      ? forwarded[0]
      : (forwarded?.split(',')[0].trim() ?? null);

    const sessionToken = await createSession(user.id, {
      userAgent: req.headers['user-agent'] ?? null,
      ip,
    });

    res.writeHead(302, {
      'Set-Cookie': serializeSessionCookie(sessionToken, {
        secure: config.app.isProduction,
      }),
      Location: frontendLocation(returnTo, '1'),
    });
    res.end();
  } catch (error) {
    logger.error('Auth callback error:', error);

    res.writeHead(302, { Location: frontendLocation(returnTo, 'error') });
    res.end();
  }
}
