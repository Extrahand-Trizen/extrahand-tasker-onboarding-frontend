'use client';

import { useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext } from '@/lib/context/AuthContext';

interface User {
  userId: string;
  email: string;
  name?: string;
  role: string;
  team?: string;
  department?: string;
  profilePhoto?: string;
}

function getApiBaseUrl(): string {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL;
  if (!apiBaseUrl) {
    throw new Error('NEXT_PUBLIC_API_URL or NEXT_PUBLIC_ADMIN_SERVICE_URL environment variable is required');
  }
  return apiBaseUrl;
}

export function useJWTAuth() {
  const ctx = useContext(AuthContext);

  // If AuthContext is available (inside AuthProvider), use shared auth state
  if (ctx) {
    return ctx;
  }

  // Fallback: standalone auth for components rendered outside AuthProvider
  return useStandaloneAuth();
}

function useStandaloneAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const accessToken = localStorage.getItem('accessToken');
      if (accessToken) {
        try {
          const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/me`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (response.ok) {
            const data = await response.json();
            setUser(data.data.user);
          } else if (response.status === 401) {
            const refreshed = await refreshAccessToken();
            if (!refreshed) {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              setUser(null);
            }
          } else {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            setUser(null);
          }
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const refreshAccessToken = async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('accessToken', data.data.accessToken);

        const userResponse = await fetch(`${getApiBaseUrl()}/api/v1/auth/me`, {
          headers: { 'Authorization': `Bearer ${data.data.accessToken}` }
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUser(userData.data.user);
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');

    setUser(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    if (accessToken && refreshToken) {
      fetch(`${getApiBaseUrl()}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      }).catch(() => {});
    }

    router.replace('/login');
  };

  const getAccessToken = async (): Promise<string | null> => {
    let token = localStorage.getItem('accessToken');
    if (token) {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            token = localStorage.getItem('accessToken');
          } else {
            return null;
          }
        }
      } catch {
        return null;
      }
    }
    return token;
  };

  return {
    user,
    loading,
    isAuthenticated: !!user,
    role: user?.role || null,
    logout,
    refreshAccessToken,
    getAccessToken,
  };
}
