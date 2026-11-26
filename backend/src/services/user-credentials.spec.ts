import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The credential reader every sync path and the API's refreshSession share.
 * A refresh happens under a row lock, so two workers syncing the same user
 * never both go to SSO; the write is a compare-and-swap on the old refresh
 * token; a revoked grant clears the token, an outage throws.
 */

const { prismaMock, tx, refreshAccessToken, loggerMock, errors } = vi.hoisted(
  () => {
    const tx = { $queryRaw: vi.fn(), user: { updateMany: vi.fn() } };
    class SsoGrantRevokedError extends Error {}
    class SsoUnavailableError extends Error {}
    return {
      tx,
      prismaMock: { user: { findUnique: vi.fn() }, $transaction: vi.fn() },
      refreshAccessToken: vi.fn(),
      loggerMock: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      errors: { SsoGrantRevokedError, SsoUnavailableError },
    };
  },
);

vi.mock('@services/eve-sso', () => ({ refreshAccessToken, ...errors }));
vi.mock('@services/logger', () => ({ default: loggerMock }));

import { loadUserCredentials, needsRefresh } from './user-credentials';

const ROW = {
  id: 7,
  character_id: 95465499,
  character_name: 'Test Pilot',
  corporation_id: 98000001,
  last_killmail_id: 1234,
  last_corp_killmail_id: null,
  last_killmail_sync_at: null,
  last_corp_killmail_sync_at: null,
  email: 'pilot@example.com',
  created_at: new Date('2026-01-01T00:00:00Z'),
};

const STALE = {
  access_token: 'current-access',
  refresh_token: 'current-refresh',
  expires_at: new Date('2026-09-21T13:00:00Z'),
};

function userRow(overrides: Record<string, unknown> = {}) {
  return { ...ROW, ...STALE, ...overrides };
}

function at(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  prismaMock.$transaction.mockImplementation(async (fn) => fn(tx));
  tx.user.updateMany.mockResolvedValue({ count: 1 });
});

describe('needsRefresh', () => {
  const now = new Date('2026-09-21T12:00:00Z');

  it('is false when the token outlives the five minute buffer', () => {
    expect(needsRefresh(new Date('2026-09-21T12:05:01Z'), now)).toBe(false);
  });

  it('is true exactly at the buffer, because the ESI call comes after it', () => {
    expect(needsRefresh(new Date('2026-09-21T12:05:00Z'), now)).toBe(true);
  });

  it('is true for a token that already expired', () => {
    expect(needsRefresh(new Date('2026-09-21T11:00:00Z'), now)).toBe(true);
  });
});

describe('loadUserCredentials', () => {
  it('reports not-found for a user that no longer exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    expect(await loadUserCredentials(7, prismaMock)).toEqual({
      ok: false,
      reason: 'not-found',
    });
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('reports no-refresh-token when the user never granted one', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      userRow({ refresh_token: null }),
    );

    expect(await loadUserCredentials(7, prismaMock)).toEqual({
      ok: false,
      reason: 'no-refresh-token',
    });
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('fresh_token_needs_no_lock', async () => {
    at('2026-09-21T12:00:00Z');
    prismaMock.user.findUnique.mockResolvedValue(userRow());

    expect(await loadUserCredentials(7, prismaMock)).toEqual({
      ok: true,
      user: ROW,
      accessToken: 'current-access',
      expiresAt: new Date('2026-09-21T13:00:00Z'),
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('refresh_writes_with_compare_and_swap', async () => {
    at('2026-09-21T12:58:00Z');
    prismaMock.user.findUnique.mockResolvedValue(userRow());
    tx.$queryRaw.mockResolvedValue([STALE]);
    refreshAccessToken.mockResolvedValue({
      access_token: 'fresh-access',
      token_type: 'Bearer',
      expires_in: 1200,
      refresh_token: 'fresh-refresh',
    });

    expect(await loadUserCredentials(7, prismaMock)).toEqual({
      ok: true,
      user: ROW,
      accessToken: 'fresh-access',
      expiresAt: new Date('2026-09-21T13:18:00Z'),
    });
    expect(refreshAccessToken).toHaveBeenCalledWith('current-refresh');
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 7, refresh_token: 'current-refresh' },
      data: {
        access_token: 'fresh-access',
        refresh_token: 'fresh-refresh',
        expires_at: new Date('2026-09-21T13:18:00Z'),
      },
    });
    const [sql] = tx.$queryRaw.mock.calls[0];
    expect(sql.join('?')).toMatch(/FOR UPDATE/);
  });

  it('keeps the old refresh token when EVE does not rotate it', async () => {
    at('2026-09-21T12:58:00Z');
    prismaMock.user.findUnique.mockResolvedValue(userRow());
    tx.$queryRaw.mockResolvedValue([STALE]);
    refreshAccessToken.mockResolvedValue({
      access_token: 'fresh-access',
      token_type: 'Bearer',
      expires_in: 1200,
    });

    await loadUserCredentials(7, prismaMock);

    expect(tx.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refresh_token: 'current-refresh' }),
      }),
    );
  });

  it('concurrent_refresh_calls_sso_once', async () => {
    // Stale when read without the lock; refreshed by another process by the
    // time the lock is held.
    at('2026-09-21T12:58:00Z');
    prismaMock.user.findUnique.mockResolvedValue(userRow());
    tx.$queryRaw.mockResolvedValue([
      {
        access_token: 'other-access',
        refresh_token: 'other-refresh',
        expires_at: new Date('2026-09-21T13:18:00Z'),
      },
    ]);

    expect(await loadUserCredentials(7, prismaMock)).toEqual({
      ok: true,
      user: ROW,
      accessToken: 'other-access',
      expiresAt: new Date('2026-09-21T13:18:00Z'),
    });
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('invalid_grant_clears_the_refresh_token', async () => {
    at('2026-09-21T12:58:00Z');
    prismaMock.user.findUnique.mockResolvedValue(userRow());
    tx.$queryRaw.mockResolvedValue([STALE]);
    refreshAccessToken.mockRejectedValue(
      new errors.SsoGrantRevokedError('revoked'),
    );

    expect(await loadUserCredentials(7, prismaMock)).toEqual({
      ok: false,
      reason: 'token-revoked',
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 7, refresh_token: 'current-refresh' },
      data: { refresh_token: null },
    });
  });

  it('transient_sso_error_throws_and_keeps_token', async () => {
    at('2026-09-21T12:58:00Z');
    prismaMock.user.findUnique.mockResolvedValue(userRow());
    tx.$queryRaw.mockResolvedValue([STALE]);
    refreshAccessToken.mockRejectedValue(new errors.SsoUnavailableError('503'));

    await expect(loadUserCredentials(7, prismaMock)).rejects.toBeInstanceOf(
      errors.SsoUnavailableError,
    );
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });
});
