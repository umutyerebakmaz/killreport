import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A login is what may bring a role the last corporation 403 lacked, so the
 * callback clears `corp_killmails_denied_at` and the corporation sync tries
 * again.
 */

const { prisma } = vi.hoisted(() => ({
  prisma: { user: { upsert: vi.fn() } },
}));

vi.mock('@config/config', () => ({
  config: {
    app: { isProduction: false },
    eveSso: { frontendUrl: 'http://localhost:3000' },
  },
}));
vi.mock('@services/auth-state-store', () => ({
  consumeAuthState: vi.fn(async () => '/'),
}));
vi.mock('@services/eve-sso', () => ({
  exchangeCodeForToken: vi.fn(async () => ({
    access_token: 'access',
    refresh_token: 'refresh',
    expires_in: 1200,
  })),
  verifyToken: vi.fn(async () => ({
    characterId: 95465499,
    characterName: 'Test Pilot',
    characterOwnerHash: 'hash',
  })),
}));
vi.mock('@services/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@services/prisma', () => ({ default: prisma }));
vi.mock('@services/character/queue-own-character', () => ({
  queueOwnCharacterIfMissing: vi.fn(),
}));
vi.mock('@services/session-store', () => ({
  createSession: vi.fn(async () => ({ token: 'session' })),
}));
vi.mock('@services/session-cookie', () => ({
  serializeSessionCookie: vi.fn(() => 'cookie'),
}));

import { handleAuthCallback } from './auth-callback.handler';

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.upsert.mockResolvedValue({
    id: 7,
    character_name: 'Test Pilot',
  });
});

describe('handleAuthCallback', () => {
  it('clears corp_killmails_denied_at on login', async () => {
    const req = {
      url: '/auth/callback?code=abc&state=xyz',
      headers: { host: 'localhost:4000' },
    };
    const res = { writeHead: vi.fn(), setHeader: vi.fn(), end: vi.fn() };

    await handleAuthCallback(req as never, res as never);

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ corp_killmails_denied_at: null }),
      }),
    );
  });
});
