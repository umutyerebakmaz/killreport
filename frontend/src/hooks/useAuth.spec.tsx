import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The session lives at module scope, so every test loads a fresh copy.
async function loadUseAuth() {
  vi.resetModules();
  return (await import('./useAuth')).useAuth;
}

function refreshOk() {
  return {
    json: async () => ({
      data: {
        refreshSession: {
          accessToken: 'new-token',
          expiresIn: 1200,
          user: { id: '90000001', name: 'Test Pilot' },
        },
      },
    }),
  };
}

function refreshError(code: string) {
  return {
    json: async () => ({
      errors: [{ message: 'refresh failed', extensions: { code } }],
    }),
  };
}

function operations(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map(([, init]) =>
    JSON.parse(init.body).query.includes('refreshSession')
      ? 'refresh'
      : 'logout',
  );
}

function seedExpiredSession() {
  localStorage.setItem('eve_access_token', 'old-token');
  localStorage.setItem('eve_token_expiry', String(Date.now() - 1000));
  localStorage.setItem(
    'eve_user',
    JSON.stringify({ characterId: '90000001', characterName: 'Test Pilot' }),
  );
}

describe('useAuth', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('signs in every component after the SSO round trip, not just the first', async () => {
    window.history.replaceState(null, '', '/killmails?login=1');
    fetchMock.mockResolvedValue(refreshOk());
    const useAuth = await loadUseAuth();

    // The header mounts several users of the hook: TrackerMenu before
    // AuthButton. The first one used to take the marker for itself.
    const tracker = renderHook(() => useAuth());
    const button = renderHook(() => useAuth());

    await waitFor(() => expect(button.result.current.isLoading).toBe(false));
    expect(button.result.current.user?.characterName).toBe('Test Pilot');
    expect(tracker.result.current.user?.characterName).toBe('Test Pilot');
    expect(operations(fetchMock)).toEqual(['refresh']);
    expect(window.location.search).toBe('');
  });

  it('keeps the session when EVE SSO is down', async () => {
    seedExpiredSession();
    fetchMock.mockResolvedValue(refreshError('SERVICE_UNAVAILABLE'));
    const useAuth = await loadUseAuth();

    renderHook(() => useAuth());

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await Promise.resolve();
    expect(operations(fetchMock)).toEqual(['refresh']);
    expect(localStorage.getItem('eve_user')).not.toBeNull();
  });

  it('logs out when the server says the session is gone', async () => {
    seedExpiredSession();
    fetchMock
      .mockResolvedValueOnce(refreshError('UNAUTHENTICATED'))
      .mockResolvedValue({ json: async () => ({ data: { logout: true } }) });
    const useAuth = await loadUseAuth();

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(localStorage.getItem('eve_user')).toBeNull());
    expect(operations(fetchMock)).toEqual(['refresh', 'logout']);
    expect(result.current.user).toBeNull();
  });
});
