const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL;
if (!API_BASE_URL) {
  throw new Error('NEXT_PUBLIC_API_URL or NEXT_PUBLIC_ADMIN_SERVICE_URL environment variable is required');
}

export interface AdminInvite {
  inviteId: string;
  token: string;
  email: string;
  role: string;
  team?: string;
  department?: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  usedBy?: string;
  usedByEmail?: string;
  usedByName?: string;
  usedAt?: string;
  emailSent: boolean;
  emailSentAt?: string;
  emailError?: string;
}

export interface CreateInviteRequest {
  email: string;
  role: 'lead_access_manager' | 'onboarder' | 'qualifier';
  team?: string;
  department?: string;
  expiryDays?: number;
}

export interface InviteListResponse {
  success: boolean;
  data: AdminInvite[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface InviteDetailsResponse {
  success: boolean;
  data: {
    inviteId: string;
    email: string;
    role: string;
    team?: string;
    department?: string;
    expiresAt: string;
  };
}

export interface CreateInviteResponse {
  success: boolean;
  data: {
    invite: AdminInvite;
    inviteLink: string;
  };
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

export const invitesApi = {
  /**
   * Create a new admin invite
   */
  async create(data: CreateInviteRequest): Promise<CreateInviteResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/invites`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create invite');
    }

    return response.json();
  },

  /**
   * List all invites
   */
  async list(filters?: {
    status?: string;
    email?: string;
    page?: number;
    limit?: number;
  }): Promise<InviteListResponse> {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    
    if (filters?.status) params.append('status', filters.status);
    if (filters?.email) params.append('email', filters.email);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const queryString = params.toString();
    const url = `${API_BASE_URL}/api/v1/admin/invites${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch invites');
    }

    return response.json();
  },

  /**
   * Get invite details by token (public - no auth required)
   */
  async getByToken(token: string): Promise<InviteDetailsResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/invites/${token}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch invite details');
    }

    return response.json();
  },

  /**
   * Revoke an invite
   */
  async revoke(inviteId: string): Promise<{ success: boolean; message: string }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/invites/${inviteId}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to revoke invite');
    }

    return response.json();
  },

  /**
   * Resend an invite
   */
  async resend(inviteId: string): Promise<{
    success: boolean;
    data: {
      inviteLink: string;
      expiresAt: string;
    };
  }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/invites/${inviteId}/resend`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to resend invite');
    }

    return response.json();
  },

  /**
   * Copy invite link to clipboard
   */
  copyInviteLink(inviteLink: string): Promise<void> {
    return navigator.clipboard.writeText(inviteLink);
  },
};
