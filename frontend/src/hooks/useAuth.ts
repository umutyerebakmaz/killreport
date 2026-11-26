'use client';

import { useSyncExternalStore } from 'react';
import { isSessionGone } from '@/utils/authErrors';

export interface UserData {
  characterId: string;
  characterName: string;
}

interface AuthState {
  user: UserData | null;
  isLoading: boolean;
  loginError: string | null;
}

const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql';
const LOGIN_ERROR_MESSAGE = 'Login failed. Please try again.';
const LOGIN_ERROR_VISIBLE_MS = 5000;
// Refresh this long before the access token expires.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/*
 * One session per page, shared by every component that calls `useAuth`.
 *
 * The header alone mounts several of them (TrackerMenu, AuthButton, the
 * drawer's copies). When each kept its own state, the first to mount took the
 * SSO `login` marker and refreshed for itself, the rest read an empty
 * localStorage, and AuthButton kept showing LOGIN until a reload. Each also ran
 * its own refresh timer, so the token was refreshed once per component.
 */
const SERVER_STATE: AuthState = {
  user: null,
  isLoading: true,
  loginError: null,
};
let state: AuthState = SERVER_STATE;
const listeners = new Set<() => void>();
let started = false;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let loginErrorTimer: ReturnType<typeof setTimeout> | null = null;

function setState(patch: Partial<AuthState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

/**
 * Read the `login` marker the SSO callback leaves behind, and take it out of
 * the address bar.
 *
 * The callback redirects straight to the page the user pressed LOGIN on, and
 * this marker is the whole of what it has to say. `replaceState` keeps it out
 * of history, so a back button or a reload never replays a login.
 */
function takeLoginMarker(): string | null {
  const params = new URLSearchParams(window.location.search);
  const marker = params.get('login');
  if (!marker) return null;

  params.delete('login');
  const query = params.toString();
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
  );

  return marker;
}

// A failed login says so beside the button and then gets out of the way. It is
// not worth a page, and it is not worth a dialog the user has to dismiss.
function reportLoginError(message: string = LOGIN_ERROR_MESSAGE) {
  if (loginErrorTimer) clearTimeout(loginErrorTimer);
  setState({ loginError: message });
  loginErrorTimer = setTimeout(
    () => setState({ loginError: null }),
    LOGIN_ERROR_VISIBLE_MS,
  );
}

function clearRefreshTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function scheduleTokenRefresh(expiresInMs: number) {
  clearRefreshTimer();
  const refreshInMs = expiresInMs - REFRESH_MARGIN_MS;
  if (refreshInMs > 0) {
    refreshTimer = setTimeout(() => void refreshToken(), refreshInMs);
  }
}

async function refreshToken(): Promise<boolean> {
  try {
    const response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation RefreshSession {
            refreshSession {
              accessToken
              expiresIn
              user {
                id
                name
              }
            }
          }
        `,
      }),
    });

    const result = await response.json();

    if (result.errors) {
      console.error('token refresh error:', result.errors);
      // Only a session the server no longer accepts ends here; an SSO outage
      // keeps the user logged in for the next attempt.
      if (isSessionGone(result.errors)) await logout();
      return false;
    }

    const data = result.data.refreshSession;
    localStorage.setItem('eve_access_token', data.accessToken);
    localStorage.setItem(
      'eve_token_expiry',
      String(Date.now() + data.expiresIn * 1000),
    );
    const user: UserData = {
      characterId: data.user.id,
      characterName: data.user.name,
    };
    localStorage.setItem('eve_user', JSON.stringify(user));
    setState({ user });

    scheduleTokenRefresh(data.expiresIn * 1000);
    return true;
  } catch (error) {
    // A network failure says nothing about the session either.
    console.error('error refreshing token:', error);
    return false;
  }
}

// Re-read the session from localStorage, which apolloClient also writes.
function checkAuth() {
  try {
    const token = localStorage.getItem('eve_access_token');
    const userData = localStorage.getItem('eve_user');
    const expiryTime = localStorage.getItem('eve_token_expiry');

    if (!token || !userData || !expiryTime) {
      clearRefreshTimer();
      setState({ user: null });
      return;
    }

    const timeUntilExpiry = parseInt(expiryTime) - Date.now();
    if (timeUntilExpiry > 0) {
      setState({ user: JSON.parse(userData) });
      if (timeUntilExpiry < REFRESH_MARGIN_MS) void refreshToken();
      else scheduleTokenRefresh(timeUntilExpiry);
    } else {
      void refreshToken();
    }
  } catch (error) {
    console.error('error checking auth:', error);
    setState({ user: null });
  }
}

async function logout() {
  clearRefreshTimer();

  try {
    await fetch(GRAPHQL_URL, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'mutation Logout { logout }' }),
    });
  } catch (error) {
    console.error('error logging out:', error);
  }

  localStorage.removeItem('eve_access_token');
  localStorage.removeItem('eve_token_expiry');
  localStorage.removeItem('eve_user');
  setState({ user: null });
  window.dispatchEvent(new Event('auth-change'));
}

// Runs once per page load, when the first component subscribes.
function start() {
  if (started) return;
  started = true;

  // One-time cleanup for browsers that logged in before the EVE refresh token
  // was removed from the client. Safe to delete once deployed for a while.
  try {
    localStorage.removeItem('eve_refresh_token');
  } catch {
    // localStorage unavailable (e.g. private browsing) - nothing to clean up.
  }

  // apolloClient clears the session on its own and announces it this way.
  window.addEventListener('auth-change', checkAuth);

  const marker = takeLoginMarker();
  if (marker === '1') {
    // Fresh back from EVE: the session cookie is set, the access token is not
    // in localStorage yet. `isLoading` stays true across the exchange so the
    // button shows its loader instead of flashing LOGIN.
    void refreshToken()
      .then((ok) => {
        if (!ok) reportLoginError();
      })
      .finally(() => setState({ isLoading: false }));
    return;
  }

  if (marker === 'error') reportLoginError();
  checkAuth();
  setState({ isLoading: false });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => SERVER_STATE;

export function useAuth() {
  const { user, isLoading, loginError } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    loginError,
    reportLoginError,
    logout,
    refreshToken,
  };
}
