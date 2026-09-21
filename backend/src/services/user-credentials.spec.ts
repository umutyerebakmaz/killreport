import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The worker-side credential reader. Tokens live in `users`, never in a queue
 * message, so every sync path asks this module for a valid access token right
 * before it calls ESI.
 */

const { prismaMock, refreshAccessToken, loggerMock } = vi.hoisted(() => ({
  prismaMock: { user: { findUnique: vi.fn(), update: vi.fn() } },
  refreshAccessToken: vi.fn(),
  loggerMock: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@services/eve-sso', () => ({ refreshAccessToken }));
vi.mock('@services/logger', () => ({ default: loggerMock }));

import { loadUserCredentials, needsRefresh } from './user-credentials';

const ROW = {
  id: 7,
  character_id: 95465499,
  character_name: 'Test Pilot',
  corporation_id: 98000001,
  last_killmail_id: 1234,
  last_corp_killmail_id: null,
};

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    ...ROW,
    access_token: 'current-access',
    refresh_token: 'current-refresh',
    expires_at: new Date('2026-09-21T13:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
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

  it('returns the stored token without refreshing when it is still valid', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T12:00:00Z'));
    prismaMock.user.findUnique.mockResolvedValue(userRow());

    const result = await loadUserCredentials(7, prismaMock);

    expect(result).toEqual({
      ok: true,
      user: ROW,
      accessToken: 'current-access',
    });
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('refreshes an expiring token and writes the new pair back', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T12:58:00Z'));
    prismaMock.user.findUnique.mockResolvedValue(userRow());
    refreshAccessToken.mockResolvedValue({
      access_token: 'fresh-access',
      token_type: 'Bearer',
      expires_in: 1200,
      refresh_token: 'fresh-refresh',
    });

    const result = await loadUserCredentials(7, prismaMock);

    expect(result).toEqual({
      ok: true,
      user: ROW,
      accessToken: 'fresh-access',
    });
    expect(refreshAccessToken).toHaveBeenCalledWith('current-refresh');
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        access_token: 'fresh-access',
        refresh_token: 'fresh-refresh',
        expires_at: new Date('2026-09-21T13:18:00Z'),
      },
    });
  });

  it('keeps the old refresh token when EVE does not rotate it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T12:58:00Z'));
    prismaMock.user.findUnique.mockResolvedValue(userRow());
    refreshAccessToken.mockResolvedValue({
      access_token: 'fresh-access',
      token_type: 'Bearer',
      expires_in: 1200,
    });

    await loadUserCredentials(7, prismaMock);

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refresh_token: 'current-refresh' }),
      }),
    );
  });

  it('reports refresh-failed instead of throwing, so the caller can ack and move on', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T12:58:00Z'));
    prismaMock.user.findUnique.mockResolvedValue(userRow());
    refreshAccessToken.mockRejectedValue(new Error('invalid_grant'));

    expect(await loadUserCredentials(7, prismaMock)).toEqual({
      ok: false,
      reason: 'refresh-failed',
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
