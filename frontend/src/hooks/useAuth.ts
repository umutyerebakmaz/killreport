'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UserData {
    characterId: string;
    characterName: string;
}

export function useAuth() {
    const [user, setUser] = useState<UserData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Token refresh function
    const refreshToken = useCallback(async () => {
        try {
            const refreshToken = localStorage.getItem('eve_refresh_token');
            if (!refreshToken) {
                console.log('No refresh token available');
                logout();
                return false;
            }

            console.log('🔄 Refreshing access token...');
            const response = await fetch(
                process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query: `
                            mutation RefreshToken($refreshToken: String!) {
                                refreshToken(refreshToken: $refreshToken) {
                                    accessToken
                                    refreshToken
                                    expiresIn
                                    user {
                                        id
                                        name
                                    }
                                }
                            }
                        `,
                        variables: { refreshToken },
                    }),
                }
            );

            const result = await response.json();

            if (result.errors) {
                console.error('Token refresh error:', result.errors);
                logout();
                return false;
            }

            const data = result.data.refreshToken;

            // Update tokens
            localStorage.setItem('eve_access_token', data.accessToken);
            if (data.refreshToken) {
                localStorage.setItem('eve_refresh_token', data.refreshToken);
            }
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
    const scheduleTokenRefresh = useCallback((expiresIn: number) => {
        // Clear existing timer
        if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
        }

        // Refresh 5 minutes before expiry (300 seconds = 5 minutes)
        const refreshTime = (expiresIn - 300) * 1000;

        if (refreshTime > 0) {
            console.log(`⏰ Token will be refreshed in ${refreshTime / 1000} seconds`);
            refreshTimerRef.current = setTimeout(() => {
                refreshToken();
            }, refreshTime);
        }
    }, [refreshToken]);

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
        checkAuth();

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
        };
    }, [checkAuth]);

    const logout = () => {
        // Clear refresh timer
        if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
            refreshTimerRef.current = null;
        }

        localStorage.removeItem('eve_access_token');
        localStorage.removeItem('eve_refresh_token');
        localStorage.removeItem('eve_token_expiry');
        localStorage.removeItem('eve_user');
        setUser(null);
        window.dispatchEvent(new Event('auth-change'));
    };

    return {
        user,
        isLoading,
        isAuthenticated: !!user,
        logout,
        refreshToken, // Export for manual refresh
    };
}
