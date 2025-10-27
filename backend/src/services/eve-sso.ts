import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../config';

const JWKS = createRemoteJWKSet(new URL(config.eveSso.jwksUrl));

export interface EveCharacter {
  characterId: number;
  characterName: string;
  characterOwnerHash: string;
}

/**
 * Eve Online SSO için authorization URL'i oluşturur
 */
export async function getAuthUrl(state: string): Promise<string> {
  const params = new URLSearchParams({
    response_type: 'code',
    redirect_uri: config.eveSso.callbackUrl,
    client_id: config.eveSso.clientId,
    scope: config.eveSso.scopes.join(' '),
    state,
  });

  return `${config.eveSso.authUrl}?${params}`;
}

/**
 * Authorization code'unu access token ile değiştirir
 */
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}> {
  const credentials = Buffer.from(
    `${config.eveSso.clientId}:${config.eveSso.clientSecret}`
  ).toString('base64');

  const response = await fetch(config.eveSso.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return await response.json();
}

/**
 * JWT token'ı doğrular ve character bilgilerini döner
 */
export async function verifyToken(token: string): Promise<EveCharacter> {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: 'login.eveonline.com',
  });

  if (!payload.sub || !payload.name || !payload.owner) {
    throw new Error('Invalid token payload');
  }

  // sub formatı: "CHARACTER:EVE:123456"
  const characterId = parseInt(payload.sub.toString().split(':')[2]);

  return {
    characterId,
    characterName: payload.name as string,
    characterOwnerHash: payload.owner as string,
  };
}

/**
 * Refresh token kullanarak yeni access token alır
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}> {
  const credentials = Buffer.from(
    `${config.eveSso.clientId}:${config.eveSso.clientSecret}`
  ).toString('base64');

  const response = await fetch(config.eveSso.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return await response.json();
}
