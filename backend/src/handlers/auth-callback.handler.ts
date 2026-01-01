/**
 * EVE SSO Authentication Callback Handler
 */

import { IncomingMessage, ServerResponse } from 'http';
import { config } from '../config';
import { exchangeCodeForToken, verifyToken } from '../services/eve-sso';
import logger from '../services/logger';
import prisma from '../services/prisma';

/**
 * Handle EVE SSO callback after user authorizes
 */
export async function handleAuthCallback(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Missing code or state parameter'
    }));
    return;
  }

  try {
    // Exchange authorization code for access token
    logger.debug('Exchanging code for token...');
    const tokenData = await exchangeCodeForToken(code);

    // Verify token and get character info
    logger.debug('Verifying token...');
    const character = await verifyToken(tokenData.access_token);
    logger.info(`✅ User authenticated: ${character.characterName} (${character.characterId})`);

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

    // Build redirect URL with auth data
    const params = new URLSearchParams({
      token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || '',
      expires_in: tokenData.expires_in.toString(),
      character_name: character.characterName,
      character_id: character.characterId.toString(),
    });

    const redirectUrl = `${config.eveSso.frontendUrl}/auth/success?${params.toString()}`;

    // Redirect to frontend
    res.writeHead(302, { 'Location': redirectUrl });
    res.end();
  } catch (error) {
    logger.error('Auth callback error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Authentication failed',
      message: errorMessage,
    }));
  }
}
