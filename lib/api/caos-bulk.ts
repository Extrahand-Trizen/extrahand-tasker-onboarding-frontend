// Import shared constants and utilities from caos.ts
const ADMIN_SERVICE_URL = process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL;
if (!ADMIN_SERVICE_URL) {
  throw new Error('NEXT_PUBLIC_ADMIN_SERVICE_URL environment variable is required');
}

async function getAdminToken(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('Admin token can only be retrieved on client side');
  }

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

export const caosBulkApi = {
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

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/admin/caos/leads/bulk-import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || error.message || 'Upload failed');
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

    const url = `${ADMIN_SERVICE_URL}/api/v1/admin/caos/leads/bulk-import/template${params.toString() ? `?${params.toString()}` : ''}`;

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
   * Get import history
   */
  async getImportHistory(page: number = 1, limit: number = 20, all?: boolean): Promise<ImportHistoryResponse> {
    const token = await getAdminToken();

    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (all) {
      params.append('all', 'true');
    }

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/admin/caos/leads/bulk-import/history?${params.toString()}`,
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
      `${ADMIN_SERVICE_URL}/api/v1/admin/caos/leads/bulk-import/${importId}`,
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
   * Export UIDs from import
   */
  async exportUids(importId: string): Promise<Blob> {
    const token = await getAdminToken();

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/admin/caos/leads/bulk-import/${importId}/export-uids`,
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

