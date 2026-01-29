// Import shared constants and utilities from caos.ts
const ADMIN_SERVICE_URL = process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL;
if (!ADMIN_SERVICE_URL) {
  throw new Error('NEXT_PUBLIC_ADMIN_SERVICE_URL environment variable is required');
}

/**
 * Get fresh admin token (JWT-based, refreshes if expired)
 * ✅ UPDATED: Matches caos.ts logic - checks JWT first, then Firebase
 */
async function getAdminToken(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('Admin token can only be retrieved on client side');
  }

  // Try to get JWT access token first (new auth system)
  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    // Verify token is not expired (basic check)
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      
      // If token expires in less than 5 minutes, try to refresh
      if (payload.exp && payload.exp - now < 300) {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          try {
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL;
            if (!API_BASE_URL) {
              throw new Error('NEXT_PUBLIC_API_URL or NEXT_PUBLIC_ADMIN_SERVICE_URL environment variable is required');
            }
            const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            });

            if (response.ok) {
              const data = await response.json();
              if (data.success && data.data?.accessToken) {
                localStorage.setItem('accessToken', data.data.accessToken);
                if (data.data.refreshToken) {
                  localStorage.setItem('refreshToken', data.data.refreshToken);
                }
                return data.data.accessToken;
              }
            }
          } catch (error) {
            // Refresh failed, continue with existing token
          }
        }
      }
      
      // Token is still valid
      return accessToken;
    } catch (error) {
      // Invalid token format, try Firebase fallback
    }
  }

  // Fallback to Firebase auth (for legacy users)
  try {
    const { auth } = await import('@/lib/config/firebase');
    const { onAuthStateChanged } = await import('firebase/auth');
    
    const currentUser = auth.currentUser;
    
    if (currentUser) {
      try {
        const token = await currentUser.getIdToken(true);
        localStorage.setItem('adminToken', token);
        return token;
      } catch (error: any) {
        throw new Error('Failed to get admin token: ' + error.message);
      }
    }
    
    return new Promise((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        unsubscribe();
        if (user) {
          try {
            const token = await user.getIdToken(true);
            localStorage.setItem('adminToken', token);
            resolve(token);
          } catch (error: any) {
            reject(new Error('Failed to get admin token: ' + error.message));
          }
        } else {
          reject(new Error('Admin not authenticated. Please login.'));
        }
      });
    });
  } catch (error) {
    throw new Error('Admin not authenticated. Please login.');
  }
}

export interface BulkLeadImportResponse {
  success: boolean;
  data: {
    importId: string;
    totalRows: number;
    successCount: number;
    failedCount: number;
    errors: Array<{
      row: number;
      phone?: string;
      error: string;
    }>;
    importedLeadIds: string[];
  };
  message: string;
}

export interface ImportHistoryResponse {
  success: boolean;
  data: {
    imports: Array<{
      importId: string;
      fileName: string;
      createdBy?: string;        // userId
      createdByName?: string;     // Uploader name
      createdByEmail?: string;    // Uploader email
      createdByRole?: 'qualifier' | 'onboarder' | 'lead_access_manager'; // Uploader role
      totalRows: number;
      successCount: number;
      failedCount: number;
      status: 'pending' | 'processing' | 'completed' | 'failed';
      operationType?: 'create' | 'update' | 'delete' | 'mixed';
      createdAt: string;
      completedAt?: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface ImportDetailsResponse {
  success: boolean;
  data: {
    importId: string;
    fileName: string;
    createdBy?: string;        // userId
    createdByName?: string;     // Uploader name
    createdByEmail?: string;    // Uploader email
    createdByRole?: 'qualifier' | 'onboarder' | 'lead_access_manager'; // Uploader role
    totalRows: number;
    successCount: number;
    failedCount: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    operationType?: 'create' | 'update' | 'delete' | 'mixed';
    errors: Array<{
      row: number;
      phone?: string;
      error: string;
    }>;
    importedUserIds: string[];
    createdAt: string;
    completedAt?: string;
  };
}

export interface BulkLeadPreviewResponse {
  success: boolean;
  data: {
    rows: Array<{
      rowNumber: number;
      name: string;
      phone: string;
      email?: string;
      city: string;
      state: string;
      primaryCategory: string;
      secondaryCategory: string;
      experienceLevel?: string;
      status: "valid" | "invalid";
      errors: string[];
      isDuplicateInFile: boolean;
      isDuplicateInDb: boolean;
      isDifferentCategory?: boolean;
      duplicateLeadId?: string;
    }>;
    summary: {
      total: number;
      valid: number;
      invalid: number;
      duplicatesInFile: number;
      duplicatesInDb: number;
      differentCategory: number;
    };
  };
}

export const caosBulkApi = {
  /**
   * Preview bulk import (validation + duplicate check, no records created)
   */
  async previewBulkImportLeads(
    file: File,
    primaryCategory?: string,
    secondaryCategory?: string
  ): Promise<BulkLeadPreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (primaryCategory) {
      formData.append('primaryCategory', primaryCategory);
    }
    if (secondaryCategory) {
      formData.append('secondaryCategory', secondaryCategory);
    }

    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/bulk-import/preview`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Preview failed' }));
      throw new Error(error.error || error.message || 'Preview failed');
    }

    return response.json();
  },

  /**
   * Bulk import leads from CSV
   */
  async bulkImportLeads(
    file: File, 
    source?: string, 
    primaryCategory?: string, 
    secondaryCategory?: string
  ): Promise<BulkLeadImportResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (source) {
      formData.append('source', source);
    }
    if (primaryCategory) {
      formData.append('primaryCategory', primaryCategory);
    }
    if (secondaryCategory) {
      formData.append('secondaryCategory', secondaryCategory);
    }

    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/bulk-import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.message || err.error || 'Upload failed');
    }

    return response.json();
  },

  /**
   * Download CSV template
   */
  async downloadTemplate(primaryCategory?: string, secondaryCategory?: string): Promise<Blob> {
    const token = await getAdminToken();

    const params = new URLSearchParams();
    if (primaryCategory) {
      params.append('primaryCategory', primaryCategory);
    }
    if (secondaryCategory) {
      params.append('secondaryCategory', secondaryCategory);
    }

    const url = `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/bulk-import/template${params.toString() ? `?${params.toString()}` : ''}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download template');
    }

    return response.blob();
  },

  /**
   * Get import history with filters (only for lead_access_manager)
   */
  async getImportHistory(
    filters?: {
      page?: number;
      limit?: number;
      role?: 'qualifier' | 'onboarder' | 'lead_access_manager';
      createdBy?: string;
      createdByEmail?: string;
      createdByName?: string;
      from?: string; // ISO date string
      to?: string;   // ISO date string
      status?: 'pending' | 'processing' | 'completed' | 'failed';
    }
  ): Promise<ImportHistoryResponse> {
    const token = await getAdminToken();

    const params = new URLSearchParams({
      page: String(filters?.page || 1),
      limit: String(filters?.limit || 20),
    });

    // Add filters
    if (filters?.role) params.append('role', filters.role);
    if (filters?.createdBy) params.append('createdBy', filters.createdBy);
    if (filters?.createdByEmail) params.append('createdByEmail', filters.createdByEmail);
    if (filters?.createdByName) params.append('createdByName', filters.createdByName);
    if (filters?.from) params.append('from', filters.from);
    if (filters?.to) params.append('to', filters.to);
    if (filters?.status) params.append('status', filters.status);

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/bulk-import/history?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || 'Failed to fetch import history');
    }

    return response.json();
  },

  /**
   * Get import details
   */
  async getImportDetails(importId: string): Promise<ImportDetailsResponse> {
    const token = await getAdminToken();

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/bulk-import/${importId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch import details');
    }

    return response.json();
  },

  /**
   * Get imported leads for an import (paginated)
   */
  async getImportedLeads(
    importId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    success: boolean;
    data: {
      users: Array<{
        uid: string;
        leadId: string;
        name?: string;
        phone?: string;
        email?: string;
        city?: string;
        state?: string;
        address?: string;
        primarySkill?: string;
        secondarySkill?: string;
        status?: string;
        createdAt?: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    };
  }> {
    const token = await getAdminToken();

    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/bulk-import/${importId}/leads?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch imported leads');
    }

    return response.json();
  },

  /**
   * Export UIDs from import
   */
  async exportUids(importId: string): Promise<Blob> {
    const token = await getAdminToken();

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/bulk-import/${importId}/export-uids`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to export UIDs');
    }

    return response.blob();
  },

  /**
   * Get comprehensive import analytics
   */
  async getImportAnalytics(): Promise<{
    success: boolean;
    data: {
      uploadsByUser: Array<{ userId: string; userName: string; userRole: string; totalUploads: number; totalLeads: number; successRate: number; avgLeadsPerUpload: number }>;
      uniqueVsDuplicate: { uniqueLeads: number; duplicateLeads: number; updatedLeads: number };
      statusDistribution: Array<{ status: string; count: number }>;
      roleBreakdown: Array<{ role: string; totalUploads: number; totalLeads: number; successRate: number }>;
      uploadsOverTime: Array<{ date: string; uploads: number; leads: number }>;
      summaryMetrics: { totalImports: number; totalLeadsImported: number; totalUniqueLeads: number; totalDuplicates: number; avgSuccessRate: number; totalUploaders: number };
      topUploaders: Array<{ userId: string; userName: string; totalLeads: number; successRate: number }>;
      qualityMetrics: { avgDuplicateRate: number; avgSuccessRate: number; avgRowsPerUpload: number; largestUpload: number };
    };
  }> {
    const token = await getAdminToken();

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/bulk-import/analytics`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch import analytics' }));
      throw new Error(error.error || error.message || 'Failed to fetch import analytics');
    }

    return response.json();
  },
};

