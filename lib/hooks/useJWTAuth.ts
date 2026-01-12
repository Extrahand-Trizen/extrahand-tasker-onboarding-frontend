'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  userId: string;
  email: string;
  name?: string;
  role: string;
  team?: string;
  department?: string;
  profilePhoto?: string;
}

// Always talk directly to the admin-service for auth
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL;
if (!API_BASE_URL) {
  throw new Error('NEXT_PUBLIC_API_URL or NEXT_PUBLIC_ADMIN_SERVICE_URL environment variable is required');
}

export function useJWTAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check for existing session on mount
    const checkAuth = async () => {
      const accessToken = localStorage.getItem('accessToken');
      if (accessToken) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            setUser(data.data.user);
          } else if (response.status === 401) {
            // Token invalid, try to refresh
            const refreshed = await refreshAccessToken();
            if (!refreshed) {
              // Refresh failed, clear everything immediately
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              setUser(null);
            }
          } else {
            // Other error, clear tokens
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            setUser(null);
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          // On any error, clear tokens and user state
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setUser(null);
        }
      } else {
        // No token, ensure user is null
        setUser(null);
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const refreshAccessToken = async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('accessToken', data.data.accessToken);
        
        // Fetch user info with new token
        const userResponse = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
          headers: {
            'Authorization': `Bearer ${data.data.accessToken}`
          }
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUser(userData.data.user);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  };

  const logout = async () => {
    // Get tokens BEFORE clearing them (for server logout)
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    
    // Clear state FIRST (immediate UI update)
    setUser(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    
    // Then try to invalidate tokens on server (non-blocking, don't wait)
    if (accessToken && refreshToken) {
      fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      }).catch((error) => {
        console.error('Logout error:', error);
      });
    }

    // Navigate to login immediately after clearing state
    router.replace('/login');
  };

  // Helper to get current access token (with auto-refresh)
  const getAccessToken = async (): Promise<string | null> => {
    let token = localStorage.getItem('accessToken');
    
    // Try to refresh if token exists
    if (token) {
      // Check if token is still valid by making a quick request
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.status === 401) {
          // Token expired, refresh it
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            token = localStorage.getItem('accessToken');
          } else {
            return null;
          }
        }
      } catch (error) {
        console.error('Token validation failed:', error);
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
