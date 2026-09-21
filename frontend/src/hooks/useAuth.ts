'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UserData {
  characterId: string;
  characterName: string;
}

const LOGIN_ERROR_MESSAGE = 'Login failed. Please try again.';
const LOGIN_ERROR_VISIBLE_MS = 5000;

/**
 * Read the `login` marker the SSO callback leaves behind, and take it out of
 * the address bar.
 *
 * The round trip used to land on `/auth/success`, a full page whose only job
 * was to call `refreshSession` and then push somewhere real. That page is gone:
 * the callback now redirects straight to the page the user pressed LOGIN on,
 * and this marker is the whole of what it has to say. `replaceState` keeps it
 * out of history, so a back button or a reload never replays a login.
 */
function takeLoginMarker(): string | null {
  if (typeof window === 'undefined') return null;

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

export function useAuth() {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const loginErrorTimerRef = useRef<NodeJS.Timeout | null>(null);

  // A failed login says so beside the button and then gets out of the way. It
  // is not worth a page, and it is not worth a dialog the user has to dismiss.
  const reportLoginError = useCallback(
    (message: string = LOGIN_ERROR_MESSAGE) => {
      if (loginErrorTimerRef.current) clearTimeout(loginErrorTimerRef.current);
      setLoginError(message);
      loginErrorTimerRef.current = setTimeout(
        () => setLoginError(null),
        LOGIN_ERROR_VISIBLE_MS,
      );
    },
    [],
  );

  // Token refresh function
  const refreshToken = useCallback(async () => {
    try {
      console.log('🔄 Refreshing access token...');
      const response = await fetch(
        process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql',
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
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
        },
      );

      const result = await response.json();

      if (result.errors) {
        console.error('Token refresh error:', result.errors);
        logout();
        return false;
      }

      const data = result.data.refreshSession;

      // Update tokens
      localStorage.setItem('eve_access_token', data.accessToken);
      const expiryTime = Date.now() + data.expiresIn * 1000;
      localStorage.setItem('eve_token_expiry', expiryTime.toString());

      // Update user data
      const userData = {
        characterId: data.user.id,
        characterName: data.user.name,
      };
      localStorage.setItem('eve_user', JSON.stringify(userData));
      setUser(userData);

      console.log('✅ Token refreshed successfully');

      // Schedule next refresh (5 minutes before expiry)
      scheduleTokenRefresh(data.expiresIn);

      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      logout();
      return false;
    }
  }, []);

  // Schedule automatic token refresh
  const scheduleTokenRefresh = useCallback(
    (expiresIn: number) => {
      // Clear existing timer
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      // Refresh 5 minutes before expiry (300 seconds = 5 minutes)
      const refreshTime = (expiresIn - 300) * 1000;

      if (refreshTime > 0) {
        console.log(
          `⏰ Token will be refreshed in ${refreshTime / 1000} seconds`,
        );
        refreshTimerRef.current = setTimeout(() => {
          refreshToken();
        }, refreshTime);
      }
    },
    [refreshToken],
  );

  const checkAuth = useCallback(() => {
    try {
      const token = localStorage.getItem('eve_access_token');
      const userData = localStorage.getItem('eve_user');
      const expiryTime = localStorage.getItem('eve_token_expiry');

      // Token var mı ve geçerli mi?
      if (token && userData && expiryTime) {
        const expiry = parseInt(expiryTime);
        const now = Date.now();
        const timeUntilExpiry = expiry - now;

        if (timeUntilExpiry > 0) {
          setUser(JSON.parse(userData));

          // If token expires in less than 5 minutes, refresh immediately
          if (timeUntilExpiry < 5 * 60 * 1000) {
            console.log('Token expires soon, refreshing immediately...');
            refreshToken();
          } else {
            // Schedule refresh for 5 minutes before expiry
            const expiresInSeconds = Math.floor(timeUntilExpiry / 1000);
            scheduleTokenRefresh(expiresInSeconds);
          }
        } else {
          // Token expired, try to refresh
          console.log('Token expired, attempting refresh...');
          refreshToken();
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [refreshToken, scheduleTokenRefresh]);

  useEffect(() => {
    // One-time cleanup for browsers that logged in before the EVE refresh
    // token was removed from the client: it used to live in localStorage
    // indefinitely, which is the exact thing this branch removes it to fix.
    // Safe to delete this block once it has been deployed for a while.
    try {
      localStorage.removeItem('eve_refresh_token');
    } catch {
      // localStorage unavailable (e.g. private browsing) - nothing to clean up.
    }

    const marker = takeLoginMarker();

    if (marker === '1') {
      // Fresh back from EVE: the session cookie is already set, but the access
      // token is not in localStorage yet. `isLoading` stays true across the
      // exchange so the button shows its loader instead of flashing LOGIN at a
      // user who has just logged in.
      //
      // The session is an external system and this effect is the one-shot
      // synchronisation with it - the use the rule's own documentation allows.
      // Nothing here sets state synchronously: every `setState` inside
      // `refreshToken` runs in a promise callback, after a network round trip.
      // The rule cannot see that, because it follows the call into
      // `refreshToken` and stops at the first `setState` it finds.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      refreshToken()
        .then((ok) => {
          if (!ok) reportLoginError();
        })
        .finally(() => setIsLoading(false));
    } else {
      if (marker === 'error') reportLoginError();
      checkAuth();
    }

    // Auth değişikliklerini dinle
    const handleAuthChange = () => {
      checkAuth();
    };

    window.addEventListener('auth-change', handleAuthChange);

    // Cleanup timer on unmount
    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      if (loginErrorTimerRef.current) {
        clearTimeout(loginErrorTimerRef.current);
      }
    };
  }, [checkAuth, refreshToken, reportLoginError]);

  const logout = async () => {
    // Clear refresh timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    try {
      await fetch(
        process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql',
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
                            mutation Logout {
                                logout
                            }
                        `,
          }),
        },
      );
    } catch (error) {
      console.error('Error logging out:', error);
    }

    localStorage.removeItem('eve_access_token');
    localStorage.removeItem('eve_token_expiry');
    localStorage.removeItem('eve_user');
    setUser(null);
    window.dispatchEvent(new Event('auth-change'));
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    loginError,
    reportLoginError,
    logout,
    refreshToken, // Export for manual refresh
  };
}
