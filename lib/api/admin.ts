const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL;
if (!API_BASE_URL) {
  throw new Error('NEXT_PUBLIC_API_GATEWAY_URL environment variable is required');
}

// For partner onboarding bulk onboarder, call admin-service directly
const ADMIN_SERVICE_URL = process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL;
if (!ADMIN_SERVICE_URL) {
  throw new Error('NEXT_PUBLIC_ADMIN_SERVICE_URL environment variable is required');
}

/**
 * Get fresh admin token (refreshes if expired)
 */
async function getAdminToken(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('Admin token can only be retrieved on client side');
  }

  const { auth } = await import('@/lib/config/firebase');
  const { onAuthStateChanged } = await import('firebase/auth');
  
  // Get current user immediately
  const currentUser = auth.currentUser;
  
  if (currentUser) {
    try {
      // Force token refresh to get a fresh token (true = force refresh)
      const token = await currentUser.getIdToken(true);
      localStorage.setItem('adminToken', token);
      return token;
    } catch (error: any) {
      throw new Error('Failed to get admin token: ' + error.message);
    }
  }
  
  // If no current user, wait for auth state change
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
}

export interface BulkUploadResponse {
  success: boolean;
  data: {
    importId: string;
    operation: 'create' | 'update' | 'delete' | 'mixed';
    success: number;
    failed: number;
    errors: Array<{ row: number; uid?: string; phone?: string; error: string }>;
    importedUserIds: string[];
    updatedUserIds?: string[];
    deletedUserIds?: string[];
  };
}

export interface ImportHistoryResponse {
  success: boolean;
  data: {
    imports: Array<{
      importId: string;
      fileName: string;
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
    totalRows: number;
    successCount: number;
    failedCount: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    operationType?: 'create' | 'update' | 'delete' | 'mixed';
    errors: Array<{ row: number; uid?: string; phone?: string; error: string }>;
    importedUserIds: string[];
    updatedUserIds?: string[];
    deletedUserIds?: string[];
    createdAt: string;
    completedAt?: string;
  };
}

export interface BulkUploadPreviewResponse {
  success: boolean;
  data: {
    rows: Array<{
      rowNumber: number;
      name: string;
      phone?: string;
      email?: string;
      city: string;
      primaryCategory: string;
      secondaryCategory: string;
      experienceLevel?: string;
      status: "valid" | "invalid";
      errors: string[];
      isDuplicateInFile: boolean;
      isDuplicateInDb: boolean;
      duplicateLeadId?: string;
    }>;
    summary: {
      total: number;
      valid: number;
      invalid: number;
      duplicatesInFile: number;
      duplicatesInDb: number;
    };
  };
}

export const adminApi = {
  /**
   * Preview bulk upload (validation + duplicate check, no records created)
   */
  async previewBulkUpload(
    file: File,
    primaryCategory?: string,
    secondaryCategory?: string
  ): Promise<BulkUploadPreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (primaryCategory) {
      formData.append('primaryCategory', primaryCategory);
    }
    if (secondaryCategory) {
      formData.append('secondaryCategory', secondaryCategory);
    }

    // Get fresh token
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/internal/bulk-upload/preview`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Preview failed' }));
      throw new Error(error.error || 'Preview failed');
    }

    return response.json();
  },

  /**
   * Upload CSV/Excel file for bulk onboarder
   */
  async bulkUploadUsers(
    file: File, 
    primaryCategory?: string, 
    secondaryCategory?: string,
    sendEmails: boolean = true
  ): Promise<BulkUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (primaryCategory) {
      formData.append('primaryCategory', primaryCategory);
    }
    if (secondaryCategory) {
      formData.append('secondaryCategory', secondaryCategory);
    }
    formData.append('sendEmails', sendEmails.toString());

    // Get fresh token (will refresh if expired)
    const token = await getAdminToken();

    // Bulk upload goes directly to tasker-onboarding backend (admin-service)
    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/internal/bulk-upload/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  },

  /**
   * Download CSV template
   */
  async downloadTemplate(
    operationType: 'create' | 'update' | 'delete',
    primaryCategory?: string,
    secondaryCategory?: string
  ): Promise<Blob> {
    const token = await getAdminToken();

    const params = new URLSearchParams({ operation: operationType });
    if (primaryCategory) {
      params.append('primaryCategory', primaryCategory);
    }
    if (secondaryCategory) {
      params.append('secondaryCategory', secondaryCategory);
    }

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/internal/bulk-upload/template?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to download template');
    }

    return response.blob();
  },

  /**
   * Get import history
   */
  async getImportHistory(page: number = 1, limit: number = 20): Promise<ImportHistoryResponse> {
    const token = await getAdminToken();

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/internal/bulk-upload/history?page=${page}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch import history');
    }

    return response.json();
  },

  /**
   * Get import details
   */
  async getImportDetails(importId: string): Promise<ImportDetailsResponse> {
    const token = await getAdminToken();

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/internal/bulk-upload/${importId}`,
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
   * Get imported users/leads for an import (paginated)
   */
  async getImportedUsers(importId: string, page: number = 1, limit: number = 10): Promise<{
    success: boolean;
    data: {
      users: Array<{ uid: string; name?: string; phone?: string; city?: string; primarySkill?: string }>;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    };
  }> {
    const token = await getAdminToken();

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/internal/bulk-upload/${importId}/users?page=${page}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch imported users');
    }

    return response.json();
  },

  /**
   * Export UIDs from import as CSV
   */
  async exportUids(importId: string): Promise<Blob> {
    const token = await getAdminToken();

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/internal/bulk-upload/${importId}/export-uids`,
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
};

