const ADMIN_SERVICE_URL = process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL;

if (!ADMIN_SERVICE_URL) {
  throw new Error('NEXT_PUBLIC_ADMIN_SERVICE_URL environment variable is required');
}

async function getAdminToken(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('Admin token can only be retrieved on client side');
  }

  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp && payload.exp - now < 300) {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL;
            if (!apiBase) {
              throw new Error('NEXT_PUBLIC_API_URL or NEXT_PUBLIC_ADMIN_SERVICE_URL environment variable is required');
            }

            const response = await fetch(`${apiBase}/api/v1/auth/refresh`, {
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
          } catch {
            // ignore refresh failure and continue with existing token
          }
        }
      }

      return accessToken;
    } catch {
      // fall through to Firebase legacy token
    }
  }

  const { auth } = await import('@/lib/config/firebase');
  if (!auth) throw new Error('Admin not authenticated. Please login.');
  const { onAuthStateChanged } = await import('firebase/auth');

  const currentUser = auth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken(true);
    localStorage.setItem('adminToken', token);
    return token;
  }

  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (!user) {
        reject(new Error('Admin not authenticated. Please login.'));
        return;
      }
      try {
        const token = await user.getIdToken(true);
        localStorage.setItem('adminToken', token);
        resolve(token);
      } catch (error: any) {
        reject(new Error('Failed to get admin token: ' + error.message));
      }
    });
  });
}

export type CertificateStatus = 'pending' | 'verified' | 'rejected';

export interface CertificateQueueItem {
  uid: string;
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  skillIndex: number;
  skillName: string;
  certificateIndex: number;
  certificate: {
    title?: string;
    issuedBy?: string;
    issuedDate?: string;
    documentUrl?: string;
    verificationType?: 'certified' | 'licensed';
    certificateType?: string;
    issuingAuthority?: string;
    certificateNumber?: string;
    issueDate?: string;
    expiryDate?: string;
    status?: CertificateStatus;
    reviewedBy?: string;
    /** Stable admin id (e.g. ADM-... or Firebase uid) */
    reviewedByUserId?: string;
    reviewedAt?: string;
    rejectionReason?: string;
    reviewNotes?: string;
  };
}

export interface CertificateQueueResponse {
  success: boolean;
  data: {
    items: CertificateQueueItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface CertificateAnalyticsData {
  period: { from: string; to: string };
  snapshot: { pendingCount: number };
  decisionsInPeriod: {
    verified: number;
    rejected: number;
    total: number;
    rejectRate: number | null;
  };
  queueTimeHours: {
    median: number | null;
    average: number | null;
    sampleSize: number;
  };
  byReviewer: Array<{
    reviewerKey: string;
    reviewerDisplayName: string | null;
    verified: number;
    rejected: number;
    total: number;
  }>;
  daily: Array<{ date: string; verified: number; rejected: number }>;
  topRejectionReasons: Array<{ reason: string; count: number }>;
}

export const certificateReviewApi = {
  async getQueue(params: {
    q?: string;
    uid?: string;
    status?: CertificateStatus;
    city?: string;
    page?: number;
    limit?: number;
  }): Promise<CertificateQueueResponse> {
    const token = await getAdminToken();
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value));
      }
    });

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/certificates/queue?${query.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch certificate queue' }));
      throw new Error(error.error || error.message || 'Failed to fetch certificate queue');
    }

    return response.json();
  },

  async getAnalytics(params: {
    from?: string;
    to?: string;
  }): Promise<{ success: boolean; data: CertificateAnalyticsData }> {
    const token = await getAdminToken();
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/certificates/analytics?${query.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch analytics' }));
      throw new Error(error.error || error.message || 'Failed to fetch analytics');
    }

    return response.json();
  },

  async verifyCertificate(params: {
    uid: string;
    skillIndex: number;
    certificateIndex: number;
    reviewNotes?: string;
  }): Promise<{ success: boolean; message: string }> {
    const token = await getAdminToken();

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/certificates/${params.uid}/${params.skillIndex}/${params.certificateIndex}/verify`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewNotes: params.reviewNotes,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to verify certificate' }));
      throw new Error(error.error || error.message || 'Failed to verify certificate');
    }

    return response.json();
  },

  async rejectCertificate(params: {
    uid: string;
    skillIndex: number;
    certificateIndex: number;
    rejectionReason: string;
    reviewNotes?: string;
  }): Promise<{ success: boolean; message: string }> {
    const token = await getAdminToken();

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/certificates/${params.uid}/${params.skillIndex}/${params.certificateIndex}/reject`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rejectionReason: params.rejectionReason,
          reviewNotes: params.reviewNotes,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to reject certificate' }));
      throw new Error(error.error || error.message || 'Failed to reject certificate');
    }

    return response.json();
  },
};
