import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The EVE SSO client. Every function here either builds a request to
 * login.eveonline.com or reads the answer, so the tests assert on the request
 * that leaves the process and on the branch each response takes — no network,
 * no real keys.
 */

// Built at runtime so no credential-shaped literal sits in the file for the
// secret scanner to trip on.
const CLIENT_ID = ['test', 'client', 'id'].join('-');
const CLIENT_SECRET = ['not', 'a', 'real', 'value'].join('-');
const EXPECTED_BASIC = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
  'base64',
);

const { configMock, jwtVerify, createRemoteJWKSet, jwksUrls } = vi.hoisted(
  () => {
    // The JWKS is built once, at module import, before any test runs — and the
    // suite clears mock call records between tests. Recording the URL on the
    // side is what keeps that one call observable.
    const jwksUrls: URL[] = [];
    return {
      jwksUrls,
      configMock: {
        eveSso: {
          clientId: ['test', 'client', 'id'].join('-'),
          clientSecret: ['not', 'a', 'real', 'value'].join('-'),
          callbackUrl: 'http://localhost:4000/auth/callback',
          frontendUrl: 'http://localhost:3000',
          authUrl: 'https://login.eveonline.com/v2/oauth/authorize',
          tokenUrl: 'https://login.eveonline.com/v2/oauth/token',
          jwksUrl: 'https://login.eveonline.com/oauth/jwks',
          scopes: ['publicData', 'esi-killmails.read_killmails.v1'],
        },
      },
      jwtVerify: vi.fn(),
      createRemoteJWKSet: vi.fn((url: URL) => {
        jwksUrls.push(url);
        return 'jwks-handle';
      }),
    };
  },
);

vi.mock('@config/config', () => ({ config: configMock }));
vi.mock('jose', () => ({ jwtVerify, createRemoteJWKSet }));

import {
  exchangeCodeForToken,
  getAuthUrl,
  refreshAccessToken,
  verifyToken,
} from './eve-sso';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

/** A fetch Response stand-in: ok with a JSON body, or a failure with text. */
function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

function errorResponse(text: string) {
  return {
    ok: false,
    json: vi.fn(),
    text: vi.fn().mockResolvedValue(text),
  };
}

/** The (url, init) pair of the nth fetch, with the body decoded. */
function fetchCall(call = 0) {
  const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  const body = new URLSearchParams(init.body as string);
  return { url, init, body, headers: init.headers as Record<string, string> };
}

const TOKENS = {
  access_token: 'access.jwt.value',
  token_type: 'Bearer',
  expires_in: 1199,
  refresh_token: 'refresh.value',
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse(TOKENS));
});

describe('getAuthUrl', () => {
  it('builds an authorize URL on the configured endpoint', async () => {
    const url = new URL(await getAuthUrl('state-123'));

    expect(`${url.origin}${url.pathname}`).toBe(
      'https://login.eveonline.com/v2/oauth/authorize',
    );
  });

  it('carries the code flow parameters and the caller state', async () => {
    const url = new URL(await getAuthUrl('state-123'));

    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      redirect_uri: 'http://localhost:4000/auth/callback',
      client_id: CLIENT_ID,
      scope: 'publicData esi-killmails.read_killmails.v1',
      state: 'state-123',
    });
  });

  it('joins the scopes with a space, as the SSO expects', async () => {
    const url = new URL(await getAuthUrl('state-123'));

    expect(url.searchParams.get('scope')).toBe(
      configMock.eveSso.scopes.join(' '),
    );
  });

  it('escapes a state that would otherwise break the query string', async () => {
    const url = new URL(await getAuthUrl('a&b=c d'));

    expect(url.searchParams.get('state')).toBe('a&b=c d');
  });
});

describe('exchangeCodeForToken', () => {
  it('posts the authorization code to the token endpoint', async () => {
    await exchangeCodeForToken('auth-code');
    const { url, init, body } = fetchCall();

    expect(url).toBe('https://login.eveonline.com/v2/oauth/token');
    expect(init.method).toBe('POST');
    expect(Object.fromEntries(body)).toEqual({
      grant_type: 'authorization_code',
      code: 'auth-code',
    });
  });

  it('authenticates with the client credentials, base64 encoded', async () => {
    await exchangeCodeForToken('auth-code');
    const { headers } = fetchCall();

    expect(headers.Authorization).toBe(`Basic ${EXPECTED_BASIC}`);
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('never puts the secret in the request body or the URL', async () => {
    await exchangeCodeForToken('auth-code');
    const { url, init } = fetchCall();

    expect(String(init.body)).not.toContain(CLIENT_SECRET);
    expect(url).not.toContain(CLIENT_SECRET);
  });

  it('returns the parsed token payload', async () => {
    await expect(exchangeCodeForToken('auth-code')).resolves.toEqual(TOKENS);
  });

  it('throws with the response body when the SSO rejects the code', async () => {
    fetchMock.mockResolvedValue(errorResponse('invalid_grant'));

    await expect(exchangeCodeForToken('stale-code')).rejects.toThrow(
      'Token exchange failed: invalid_grant',
    );
  });
});

describe('refreshAccessToken', () => {
  it('posts the refresh grant to the token endpoint', async () => {
    await refreshAccessToken('refresh-value');
    const { url, init, body } = fetchCall();

    expect(url).toBe('https://login.eveonline.com/v2/oauth/token');
    expect(init.method).toBe('POST');
    expect(Object.fromEntries(body)).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'refresh-value',
    });
  });

  it('authenticates with the same basic credentials', async () => {
    await refreshAccessToken('refresh-value');

    expect(fetchCall().headers.Authorization).toBe(`Basic ${EXPECTED_BASIC}`);
  });

  it('returns the parsed token payload', async () => {
    await expect(refreshAccessToken('refresh-value')).resolves.toEqual(TOKENS);
  });

  it('throws with the response body when the refresh token is spent', async () => {
    fetchMock.mockResolvedValue(errorResponse('invalid_token'));

    await expect(refreshAccessToken('spent')).rejects.toThrow(
      'Token refresh failed: invalid_token',
    );
  });

  it('distinguishes its failure from the exchange failure', async () => {
    fetchMock.mockResolvedValue(errorResponse('invalid_token'));

    await expect(refreshAccessToken('spent')).rejects.toThrow(
      /^Token refresh failed/,
    );
  });
});

describe('verifyToken', () => {
  const payload = {
    sub: 'CHARACTER:EVE:95465499',
    name: 'CCP Zoetrope',
    owner: 'owner-hash-value',
  };

  beforeEach(() => {
    jwtVerify.mockResolvedValue({ payload });
  });

  it('verifies against the remote JWKS and the EVE issuer', async () => {
    await verifyToken('a.jwt.value');

    expect(jwtVerify).toHaveBeenCalledWith('a.jwt.value', 'jwks-handle', {
      issuer: 'https://login.eveonline.com',
    });
  });

  it('builds the JWKS from the configured URL, once per process', () => {
    expect(jwksUrls).toHaveLength(1);
    expect(jwksUrls[0]).toEqual(
      new URL('https://login.eveonline.com/oauth/jwks'),
    );
  });

  it('reads the character id out of the CHARACTER:EVE:<id> subject', async () => {
    await expect(verifyToken('a.jwt.value')).resolves.toEqual({
      characterId: 95465499,
      characterName: 'CCP Zoetrope',
      characterOwnerHash: 'owner-hash-value',
    });
  });

  it('lets a verification failure through rather than swallowing it', async () => {
    jwtVerify.mockRejectedValue(new Error('signature verification failed'));

    await expect(verifyToken('tampered.jwt.value')).rejects.toThrow(
      'signature verification failed',
    );
  });

  it.each(['sub', 'name', 'owner'])(
    'rejects a payload missing %s',
    async (field) => {
      jwtVerify.mockResolvedValue({
        payload: { ...payload, [field]: undefined },
      });

      await expect(verifyToken('a.jwt.value')).rejects.toThrow(
        'Invalid token payload',
      );
    },
  );

  it('rejects an empty payload', async () => {
    jwtVerify.mockResolvedValue({ payload: {} });

    await expect(verifyToken('a.jwt.value')).rejects.toThrow(
      'Invalid token payload',
    );
  });
});
