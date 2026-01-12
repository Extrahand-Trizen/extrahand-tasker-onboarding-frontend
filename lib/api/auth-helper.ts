/**
 * Get JWT access token from localStorage
 * If token is expired, automatically refreshes it
 */
export async function getJWTToken(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('JWT token can only be retrieved on client side');
  }

  let token = localStorage.getItem('accessToken');
  
  if (!token) {
    throw new Error('Not authenticated. Please login.');
  }

  // Check if token needs refresh by decoding it
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresAt = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();

    // If token expires in less than 1 minute, refresh it
    if (expiresAt - now < 60000) {
      token = await refreshJWTToken();
    }
  } catch (error) {
    // If token can't be decoded, try to refresh
    token = await refreshJWTToken();
  }

  return token;
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshJWTToken(): Promise<string> {
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (!refreshToken) {
    throw new Error('No refresh token available. Please login again.');
  }

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL;
  if (!API_BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_URL or NEXT_PUBLIC_ADMIN_SERVICE_URL environment variable is required');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      throw new Error('Session expired. Please login again.');
    }

    const data = await response.json();
    const newToken = data.data.accessToken;
    
    localStorage.setItem('accessToken', newToken);
    return newToken;
  } catch (error) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    throw new Error('Session expired. Please login again.');
  }
}

/**
 * Get authorization headers with JWT token
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  try {
    const token = await getJWTToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  } catch (error) {
    // If not authenticated, just return Content-Type header
    return {
      'Content-Type': 'application/json',
    };
  }
}

/**
 * Make authenticated API request with automatic token refresh
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  // If unauthorized, try refreshing token and retry once
  if (response.status === 401) {
    try {
      await refreshJWTToken();
      const newHeaders = await getAuthHeaders();
      
      return fetch(url, {
        ...options,
        headers: {
          ...newHeaders,
          ...options.headers,
        },
      });
    } catch (error) {
      // Refresh failed, redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw error;
    }
  }

  return response;
}
