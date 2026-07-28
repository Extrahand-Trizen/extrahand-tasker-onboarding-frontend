'use client';

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';

interface User {
  userId: string;
  email: string;
  name?: string;
  role: string;
  team?: string;
  department?: string;
  profilePhoto?: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  role: string | null;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  getAccessToken: () => Promise<string | null>;
}

function getApiBaseUrl(): string {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL;
  if (!apiBaseUrl) {
    throw new Error('NEXT_PUBLIC_API_URL or NEXT_PUBLIC_ADMIN_SERVICE_URL environment variable is required');
  }
  return apiBaseUrl;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const checkAuth = async () => {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        setState({ user: null, loading: false });
        return;
      }

      try {
        const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/me`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (response.ok) {
          const data = await response.json();
          setState({ user: data.data.user, loading: false });
          return;
        }

        if (response.status === 401) {
          const refreshed = await attemptRefresh();
          if (!refreshed) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
          }
          setState({ user: refreshed ? state.user : null, loading: false });
          return;
        }

        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setState({ user: null, loading: false });
      } catch {
        setState({ user: null, loading: false });
      }
    };

    checkAuth();
  }, []);

  const attemptRefresh = async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) return false;

      const data = await response.json();
      localStorage.setItem('accessToken', data.data.accessToken);

      const userRes = await fetch(`${getApiBaseUrl()}/api/v1/auth/me`, {
        headers: { 'Authorization': `Bearer ${data.data.accessToken}` }
      });

      if (userRes.ok) {
        const userData = await userRes.json();
        setState({ user: userData.data.user, loading: false });
        return true;
      }

      return false;
    } catch {
      return false;
    }
  };

  const logout = useCallback(async () => {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');

    setState({ user: null, loading: false });
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
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    return attemptRefresh();
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    let token = localStorage.getItem('accessToken');
    if (!token) return null;

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 401) {
        const refreshed = await attemptRefresh();
        if (refreshed) {
          token = localStorage.getItem('accessToken');
        } else {
          return null;
        }
      }
    } catch {
      return null;
    }

    return token;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        isAuthenticated: !!state.user,
        role: state.user?.role || null,
        logout,
        refreshAccessToken,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return ctx;
}
