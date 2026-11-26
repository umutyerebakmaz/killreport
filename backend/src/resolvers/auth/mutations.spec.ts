import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * refreshSession maps the credential reader's answers: a user who has to log
 * in again is UNAUTHENTICATED, an SSO outage is not — the session is still
 * good and the next attempt will work.
 */

const { loadUserCredentials, resolveSession, errors } = vi.hoisted(() => {
  class SsoGrantRevokedError extends Error {}
  class SsoUnavailableError extends Error {}
  return {
    loadUserCredentials: vi.fn(),
    resolveSession: vi.fn(),
    errors: { SsoGrantRevokedError, SsoUnavailableError },
  };
});

vi.mock('@config/config', () => ({ config: { app: { isProduction: false } } }));
vi.mock('@services/auth-state-store', () => ({
  createAuthState: vi.fn(),
  sanitizeReturnTo: vi.fn(),
}));
vi.mock('@services/eve-sso', () => ({ getAuthUrl: vi.fn(), ...errors }));
vi.mock('@services/prisma', () => ({ default: {} }));
vi.mock('@services/session-cookie', () => ({
  clearSessionCookie: vi.fn(),
  serializeSessionCookie: vi.fn(() => 'cookie'),
}));
vi.mock('@services/session-store', () => ({
  resolveSession,
  revokeSessionById: vi.fn(),
  revokeSessionByToken: vi.fn(),
}));
vi.mock('@services/user-credentials', () => ({ loadUserCredentials }));

import { authMutations } from './mutations';

const refreshSession = authMutations.refreshSession as unknown as (
  parent: unknown,
  args: unknown,
  context: unknown,
) => Promise<unknown>;

function context() {
  return { sessionToken: 'session', setCookies: [] as string[] };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveSession.mockResolvedValue({ userId: 7 });
});

describe('refreshSession', () => {
  it('is UNAUTHENTICATED when the grant was revoked', async () => {
    loadUserCredentials.mockResolvedValue({
      ok: false,
      reason: 'token-revoked',
    });

    await expect(refreshSession({}, {}, context())).rejects.toMatchObject({
      extensions: { code: 'UNAUTHENTICATED' },
    });
  });

  it('is SERVICE_UNAVAILABLE, not UNAUTHENTICATED, when SSO is down', async () => {
    loadUserCredentials.mockRejectedValue(
      new errors.SsoUnavailableError('503'),
    );

    await expect(refreshSession({}, {}, context())).rejects.toMatchObject({
      extensions: { code: 'SERVICE_UNAVAILABLE' },
    });
  });
});
