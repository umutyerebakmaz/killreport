'use client';

import { useEffect, useState } from 'react';

export interface UserData {
    characterId: string;
    characterName: string;
}

export function useAuth() {
    const [user, setUser] = useState<UserData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkAuth = () => {
        try {
            const token = localStorage.getItem('eve_access_token');
            const userData = localStorage.getItem('eve_user');
            const expiryTime = localStorage.getItem('eve_token_expiry');

            // Token var mı ve geçerli mi?
            if (token && userData && expiryTime) {
                const expiry = parseInt(expiryTime);
                if (Date.now() < expiry) {
                    setUser(JSON.parse(userData));
                } else {
                    // Token süresi dolmuş
                    logout();
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
    };

    useEffect(() => {
        checkAuth();

        // Auth değişikliklerini dinle
        const handleAuthChange = () => {
            checkAuth();
        };

        window.addEventListener('auth-change', handleAuthChange);
        return () => window.removeEventListener('auth-change', handleAuthChange);
    }, []);

    const logout = () => {
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
    };
}
