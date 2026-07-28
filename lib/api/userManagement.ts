import { fetchWithAuth } from './auth-helper';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL;

export interface AdminUser {
  userId: string;
  email: string;
  name?: string;
  role: 'lead_access_manager' | 'onboarder' | 'qualifier' | 'support' | 'trust';
  team?: string;
  department?: string;
  status: 'active' | 'suspended' | 'inactive';
  joinedVia: 'invite' | 'manual' | 'legacy';
  createdAt: string;
  lastLoginAt?: string;
  loginCount: number;
  inviteEmail?: string;
  inviteInfo?: {
    email: string;
    createdAt: string;
    expiresAt: string;
    status: string;
    usedByEmail?: string;
    usedByName?: string;
    usedAt?: string;
  };
  activeSessions?: Session[];
  activityTimeline?: ActivityItem[];
}

export interface UserListResponse {
  success: boolean;
  data: AdminUser[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  stats?: {
    total: number;
    active: number;
    suspended: number;
    inactive: number;
    newThisMonth: number;
  };
}

export interface Session {
  id: number;
  deviceInfo: string;
  ipAddress: string;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt: string;
  token?: string;
}

export interface ActivityItem {
  type: 'account_created' | 'invite_accepted' | 'role_changed' | 'last_login';
  date: string;
  description: string;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

export const userManagementApi = {
  /**
   * List all admin users with pagination and sorting
   */
  async list(filters?: {
    status?: string;
    role?: string;
    search?: string;
    page?: number;
    limit?: number;
    sort?: string;
    dir?: 'asc' | 'desc';
  }): Promise<UserListResponse> {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    
    if (filters?.status) params.append('status', filters.status);
    if (filters?.role) params.append('role', filters.role);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.sort) params.append('sort', filters.sort);
    if (filters?.dir) params.append('dir', filters.dir);

    const queryString = params.toString();
    const url = `${API_BASE_URL}/api/v1/admin/users${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch users');
    }

    return response.json();
  },

  /**
   * Get user by ID
   */
  async getById(userId: string): Promise<{ success: boolean; data: AdminUser }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/users/${userId}`, { headers });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch user');
    }

    return response.json();
  },

  /**
   * Update user role
   */
  async updateRole(userId: string, role: string): Promise<{ success: boolean; data: AdminUser }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/users/${userId}/role`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update role');
    }

    return response.json();
  },

  /**
   * Update user status
   */
  async updateStatus(userId: string, status: string): Promise<{ success: boolean; data: AdminUser }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/users/${userId}/status`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update status');
    }

    return response.json();
  },

  /**
   * Update user details
   */
  async update(userId: string, data: { name?: string; team?: string; department?: string }): Promise<{ success: boolean; data: AdminUser }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update user');
    }

    return response.json();
  },

  /**
   * Reset user password (admin-initiated)
   */
  async resetPassword(userId: string): Promise<{ 
    success: boolean; 
    message: string; 
    data?: { 
      emailSent: boolean; 
      resetLink?: string;
      email?: string;
      expiresAt?: string;
    };
    error?: string;
  }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/users/${userId}/reset-password`, {
      method: 'POST',
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // Include error details in the thrown error
      const errorMessage = data.error || data.message || 'Failed to reset password';
      const error = new Error(errorMessage) as any;
      error.data = data.data; // Include reset link and email if available
      throw error;
    }

    return data;
  },

  /**
   * Get user sessions
   */
  async getSessions(userId: string): Promise<{ success: boolean; data: Session[] }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/users/${userId}/sessions`, { headers });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch sessions');
    }

    return response.json();
  },

  /**
   * Revoke a specific session
   */
  async revokeSession(userId: string, sessionIndex: number): Promise<{ success: boolean; message: string }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/users/${userId}/sessions/${sessionIndex}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to revoke session');
    }

    return response.json();
  },

  /**
   * Revoke all sessions
   */
  async revokeAllSessions(userId: string): Promise<{ success: boolean; message: string }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/users/${userId}/sessions`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to revoke sessions');
    }

    return response.json();
  },

  /**
   * Delete a user
   */
  async delete(userId: string): Promise<{ success: boolean; message: string }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete user');
    }

    return response.json();
  },

  /**
   * Get assignments summary
   */
  async getAssignmentsSummary(userId: string): Promise<{
    success: boolean;
    data: {
      role: string;
      leadsAddedCount: number;
      leadsPickedCount: number;
      contactedCount: number;
      interestedCount: number;
      followupsCount: number;
      totalAssignments: number;
      hasAssignments: boolean;
      remainingActiveAdmins: Array<{ userId: string; name: string; email: string }>;
      canDelete: boolean;
    };
  }> {
    console.log('[userManagementApi] Fetching assignments summary for userId:', userId);
    const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/admin/users/${userId}/assignments-summary`);

    if (!response.ok) {
      let errMsg = `Request failed (${response.status})`;
      try {
        const err = await response.json();
        errMsg = err.error || err.message || errMsg;
      } catch (_) {}
      console.error('[userManagementApi] getAssignmentsSummary failed:', errMsg);
      throw new Error(errMsg);
    }

    const data = await response.json();
    console.log('[userManagementApi] getAssignmentsSummary success:', data);
    return data;
  },

  /**
   * Transfer assignments and delete user
   */
  async transferAndDelete(userId: string): Promise<{
    success: boolean;
    message: string;
    data: {
      transferredAddedCount: number;
      transferredPickedCount: number;
      redistributedTo: Array<{ userId: string; name: string; email: string }>;
    };
  }> {
    console.log('[userManagementApi] Calling transferAndDelete for userId:', userId);
    const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/admin/users/${userId}/transfer-and-delete`, {
      method: 'POST',
    });

    if (!response.ok) {
      let errMsg = `Request failed (${response.status})`;
      try {
        const err = await response.json();
        errMsg = err.error || err.message || errMsg;
      } catch (_) {}
      console.error('[userManagementApi] transferAndDelete failed:', errMsg);
      throw new Error(errMsg);
    }

    const data = await response.json();
    console.log('[userManagementApi] transferAndDelete success:', data);
    return data;
  },
};
