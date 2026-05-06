const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL;
const ADMIN_SERVICE_URL = process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL;

if (!ADMIN_SERVICE_URL) {
  throw new Error('NEXT_PUBLIC_ADMIN_SERVICE_URL environment variable is required');
}

/**
 * Get fresh admin token (JWT-based, refreshes if expired)
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
    if (!auth) throw new Error('Admin not authenticated. Please login.');
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

// ✅ LEAD STATUS - CRM/Onboarding concern (ends at approved)
export type LeadStatus = 
  | 'lead_added'
  | 'contacted_not_lifted'
  | 'contacted_not_interested'
  | 'contacted_interested'
  | 'documents_submitted'
  | 'under_verification'
  | 'approved'
  | 'inactive';

// ✅ ACCOUNT STATUS - Auth/Platform concern (starts after lead approval)
export type AccountStatus = 
  | 'not_created'  // No login exists yet
  | 'invited'      // Invite sent, waiting for user
  | 'activated'    // User accepted invite + can log in
  | 'suspended';   // Access blocked

export type CreationMethod = 'manual_onboarding' | 'bulk_upload' | 'direct_activation';

export type LeadSource = 'referral' | 'campaign' | 'walk-in' | 'agent' | 'other';

export interface Lead {
  leadId: string;
  name: string;
  phone?: string; // Made optional - either phone or landline required
  landline?: string; // New optional field
  email?: string;
  city: string;
  state?: string;
  address?: string;
  primaryCategory: string;
  secondaryCategory?: string;
  source: LeadSource;
  sourceDetails?: string;
  addedBy: string;
  addedByName?: string;
  status: LeadStatus;  // ✅ Lead status only (ends at approved)
  accountStatus: AccountStatus;  // ✅ NEW: Separate account status (starts after approval)
  statusHistory: Array<{
    status: LeadStatus;
    changedBy: string;
    changedByName?: string;
    changedAt: string;
    notes?: string;
    statusReasonCode?: string;
    statusReasonText?: string;
    callbackAt?: string;
    expectedOnboardingAt?: string;
  }>;
  skills: Array<{
    name: string;
    category?: string;
    level?: 'beginner' | 'experienced';
    toolsAvailable?: boolean;
    assignedBy?: string;
    assignedAt?: string;
  }>;
  documents: Array<{
    type: 'aadhaar' | 'pan' | 'address_proof' | 'skill_certificate' | 'photo' | 'other';
    url?: string;
    uploadedAt?: string;
    status: 'pending' | 'verified' | 'rejected';
    rejectionReason?: string;
    verifiedBy?: string;
    verifiedAt?: string;
    aadhaarNumber?: string; // Masked format: XXXX XXXX 1234
    panNumber?: string; // Masked format: ABXXXX1234
    addressDetails?: string; // Manual address entry
  }>;
  verificationStatus: {
    aadhaar?: {
      status: 'pending' | 'verified' | 'failed';
      verifiedAt?: string;
      refId?: string;
    };
    pan?: {
      status: 'pending' | 'verified' | 'failed';
      verifiedAt?: string;
    };
    bank?: {
      status: 'pending' | 'verified' | 'failed';
      verifiedAt?: string;
    };
  };
  internalNotes: Array<{
    note: string;
    addedBy: string;
    addedByName?: string;
    addedAt: string;
    isPrivate?: boolean;
  }>;
  isDuplicate: boolean;
  blacklisted: boolean;
  lastContactedAt?: string;
  lastContactedBy?: string;
  nextCallbackAt?: string;
  expectedOnboardingAt?: string;
  statusReasonCode?: string;
  statusReasonText?: string;
  activationData?: {
    activatedAt: string;
    firebaseUid: string;
    profileCreated: boolean;
  };
  conversionData?: {
    platformUid?: string;
    isAadhaarVerified?: boolean;
    lastCheckedAt?: string;
  };
  creationMethod?: CreationMethod;
  createdAt: string;
  updatedAt: string;
}

export interface ConversionStatusData {
  converted: boolean;
  platformUid?: string;
  isAadhaarVerified?: boolean;
  name?: string;
}

export interface VerifiedCertificateItem {
  skillName: string;
  certificateType?: string;
  issuingAuthority?: string;
  certificateNumber?: string;
  uploadedAt?: string;
  reviewedAt?: string;
}

export interface LeadStatusReasonOption {
  code: string;
  label: string;
}

export interface CreateLeadData {
  name: string;
  phone?: string;
  landline?: string;
  email?: string;
  city?: string;
  state?: string;
  address?: string; // Local Area
  pincode?: string;
  primaryCategory?: string;
  secondaryCategory?: string;
  experienceLevel?: 'beginner' | 'intermediate' | 'experienced';
  workingDays?: string;
  preferredTimeSlot?: string;
  source?: LeadSource;
  sourceDetails?: string;
}

export interface SearchLeadsParams {
  status?: LeadStatus;
  city?: string;
  primarySkill?: string;
  source?: LeadSource;
  addedBy?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  registrationStatus?: 'not_registered' | 'registered' | 'registered_verified';
  statusChangedBy?: string;
}

export interface SearchLeadsResponse {
  success: boolean;
  data: Lead[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CallbackQueueResponse {
  success: boolean;
  data: Lead[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CallbackQueueStatsResponse {
  success: boolean;
  data: {
    totalScheduled: number;
    overdue: number;
    dueToday: number;
  };
}

export interface FollowUpQueueItem extends Lead {
  dueType: 'callback' | 'onboarding';
  dueAt: string;
}

export interface FollowUpQueueResponse {
  success: boolean;
  data: FollowUpQueueItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FollowUpQueueStatsResponse {
  success: boolean;
  data: {
    callbackTotal: number;
    onboardingTotal: number;
    callbackDueToday: number;
    callbackOverdue: number;
    onboardingDueToday: number;
    onboardingOverdue: number;
    totalFollowUps: number;
  };
}

export interface StatusAnalyticsResponse {
  success: boolean;
  data: {
    touchedLeads: number;
    interested: number;
    notInterested: number;
    callbackScheduled: number;
    callbackOverdue: number;
    statusCounts: Array<{ status: string; count: number }>;
    qualifierBreakdown: Array<{ qualifierId: string; qualifierName: string; touchedLeads: number }>;
  };
}

export type StatusReportCategory =
  | 'touched_leads'
  | 'interested'
  | 'callback_scheduled'
  | 'callback_overdue';

export interface DuplicateCheckResponse {
  success: boolean;
  data: {
    isDuplicate: boolean;
    existingLead?: Lead;
    matchType?: 'phone' | 'name_city';
  };
}

export interface AnalyticsResponse {
  success: boolean;
  data: {
    statusCounts: Array<{ status: LeadStatus; count: number }>;
    sourceCounts: Array<{ source: LeadSource; count: number }>;
    cityCounts: Array<{ city: string; count: number }>;
    skillCounts: Array<{ primarySkill: string; count: number }>;
  };
}

export interface DashboardMetricsResponse {
  success: boolean;
  data: {
    taskersAadhaarVerified: number;
  };
}

export const caosApi = {
  /**
   * Create a new lead
   */
  async createLead(data: CreateLeadData): Promise<{ success: boolean; data: Lead; message: string }> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to create lead' }));
      throw new Error(error.error || error.message || 'Failed to create lead');
    }

    return response.json();
  },

  /**
   * Search and filter leads
   */
  async searchLeads(params: SearchLeadsParams = {}): Promise<SearchLeadsResponse> {
    const token = await getAdminToken();

    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value));
      }
    });

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads?${queryParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch leads' }));
      throw new Error(error.error || error.message || 'Failed to fetch leads');
    }

    return response.json();
  },

  async getCallbackQueue(params: {
    city?: string;
    primarySkill?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<CallbackQueueResponse> {
    const token = await getAdminToken();

    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value));
      }
    });

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/callback-queue?${queryParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch callback queue' }));
      throw new Error(error.error || error.message || 'Failed to fetch callback queue');
    }

    return response.json();
  },

  async getCallbackQueueStats(): Promise<CallbackQueueStatsResponse> {
    const token = await getAdminToken();

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/callback-queue/stats`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch callback queue stats' }));
      throw new Error(error.error || error.message || 'Failed to fetch callback queue stats');
    }

    return response.json();
  },

  async getFollowUpQueue(params: {
    city?: string;
    primarySkill?: string;
    startDate?: string;
    endDate?: string;
    addedBy?: string;
    dueType?: 'all' | 'callback' | 'onboarding';
    bucket?: 'all' | 'today' | 'overdue' | 'upcoming' | 'range';
    page?: number;
    limit?: number;
  } = {}): Promise<FollowUpQueueResponse> {
    const token = await getAdminToken();

    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value));
      }
    });

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/follow-up-queue?${queryParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch follow-up queue' }));
      throw new Error(error.error || error.message || 'Failed to fetch follow-up queue');
    }

    return response.json();
  },

  async getFollowUpQueueStats(params: { addedBy?: string } = {}): Promise<FollowUpQueueStatsResponse> {
    const token = await getAdminToken();
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value));
      }
    });

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/follow-up-queue/stats?${queryParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch follow-up queue stats' }));
      throw new Error(error.error || error.message || 'Failed to fetch follow-up queue stats');
    }

    return response.json();
  },

  async getDashboardMetrics(): Promise<DashboardMetricsResponse> {
    const token = await getAdminToken();

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/dashboard-metrics`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch dashboard metrics' }));
      throw new Error(error.error || error.message || 'Failed to fetch dashboard metrics');
    }

    return response.json();
  },

  async getStatusAnalytics(params: {
    from?: string;
    to?: string;
    qualifierId?: string;
  } = {}): Promise<StatusAnalyticsResponse> {
    const token = await getAdminToken();
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value));
      }
    });

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/status-analytics?${queryParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch status analytics' }));
      throw new Error(error.error || error.message || 'Failed to fetch status analytics');
    }

    return response.json();
  },

  async downloadStatusReport(params: {
    format: 'csv' | 'xlsx';
    template: 'eod' | 'detailed';
    reportCategory: StatusReportCategory;
    from?: string;
    to?: string;
    qualifierId?: string;
    includeNotes?: boolean;
  }): Promise<{ blob: Blob; filename: string }> {
    const token = await getAdminToken();
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value));
      }
    });

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/status-reports/export?${queryParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to export status report' }));
      throw new Error(error.error || error.message || 'Failed to export status report');
    }

    const disposition = response.headers.get('content-disposition') || '';
    const filenameMatch = disposition.match(/filename="([^"]+)"/);
    const filename = filenameMatch?.[1] || `lead-status-report.${params.format}`;

    return {
      blob: await response.blob(),
      filename,
    };
  },

  /**
   * Get partner onboarding analytics overview
   */
  async getAnalytics(): Promise<AnalyticsResponse> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/analytics/overview`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch analytics' }));
      throw new Error(error.error || error.message || 'Failed to fetch analytics');
    }

    return response.json();
  },

  /**
   * Get lead by ID
   */
  async getLead(leadId: string): Promise<{ success: boolean; data: Lead }> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/${leadId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Lead not found' }));
      throw new Error(error.error || error.message || 'Lead not found');
    }

    return response.json();
  },

  /**
   * Get conversion status (did lead register on main website and verify Aadhaar?)
   */
  async getConversionStatus(leadId: string): Promise<{ success: boolean; data: ConversionStatusData }> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/${leadId}/conversion-status`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to get conversion status' }));
      throw new Error(error.error || error.message || 'Failed to get conversion status');
    }

    return response.json();
  },

  /**
   * Get verified skill certificates for a lead
   */
  async getVerifiedCertificates(leadId: string): Promise<{
    success: boolean;
    data: {
      platformUid?: string;
      certificates: VerifiedCertificateItem[];
    };
  }> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/${leadId}/verified-certificates`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to get verified certificates' }));
      throw new Error(error.error || error.message || 'Failed to get verified certificates');
    }

    return response.json();
  },

  async getStatusReasonCodes(): Promise<{ success: boolean; data: string[] }> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/status-reason-codes`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to get status reason codes' }));
      throw new Error(error.error || error.message || 'Failed to get status reason codes');
    }

    return response.json();
  },

  /**
   * Update lead
   */
  async updateLead(leadId: string, data: Partial<CreateLeadData>): Promise<{ success: boolean; data: Lead; message: string }> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/${leadId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to update lead' }));
      throw new Error(error.error || error.message || 'Failed to update lead');
    }

    return response.json();
  },

  /**
   * Update lead status
   */
  async updateStatus(
    leadId: string,
    status: LeadStatus,
    notes?: string,
    extras?: {
      statusReasonCode?: string;
      statusReasonText?: string;
      callbackAt?: string;
      expectedOnboardingAt?: string;
    }
  ): Promise<{ success: boolean; data: Lead; message: string }> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/${leadId}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, notes, ...extras }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to update status' }));
      throw new Error(error.error || error.message || 'Failed to update status');
    }

    return response.json();
  },

  /**
   * Add internal note
   */
  async addNote(leadId: string, note: string, isPrivate?: boolean): Promise<{ success: boolean; data: Lead; message: string }> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/${leadId}/notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ note, isPrivate }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to add note' }));
      throw new Error(error.error || error.message || 'Failed to add note');
    }

    return response.json();
  },

  /**
   * Check for duplicates
   */
  async checkDuplicate(value: string, type: 'phone' | 'landline' = 'phone', name?: string, city?: string): Promise<DuplicateCheckResponse> {
    const token = await getAdminToken();

    const body: any = { name, city };
    if (type === 'phone') {
      body.phone = value;
    } else {
      body.landline = value;
    }

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/duplicate-check`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to check duplicate' }));
      throw new Error(error.error || error.message || 'Failed to check duplicate');
    }

    return response.json();
  },

  /**
   * Get status history
   */
  async getStatusHistory(leadId: string): Promise<{ success: boolean; data: { statusHistory: Lead['statusHistory']; currentStatus: LeadStatus } }> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/${leadId}/history`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch history' }));
      throw new Error(error.error || error.message || 'Failed to fetch history');
    }

    return response.json();
  },

  /**
   * Upload document
   */
  async uploadDocument(
    leadId: string, 
    type: Lead['documents'][0]['type'], 
    url?: string,
    manualData?: { aadhaarNumber?: string; panNumber?: string; addressDetails?: string }
  ): Promise<{ success: boolean; data: Lead; message: string }> {
    const token = await getAdminToken();

    const body: any = { type };
    if (url) body.url = url;
    if (manualData?.aadhaarNumber) body.aadhaarNumber = manualData.aadhaarNumber;
    if (manualData?.panNumber) body.panNumber = manualData.panNumber;
    if (manualData?.addressDetails) body.addressDetails = manualData.addressDetails;

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/${leadId}/documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to upload document' }));
      throw new Error(error.error || error.message || 'Failed to upload document');
    }

    return response.json();
  },

  /**
   * Verify or reject document
   */
  async verifyDocument(
    leadId: string,
    documentIndex: number,
    status: 'verified' | 'rejected',
    rejectionReason?: string,
    exactDetails?: {
      exactAadhaarNumber?: string;
      exactPANNumber?: string;
      exactAddressDetails?: string;
    }
  ): Promise<{ success: boolean; data: Lead; message: string }> {
    const token = await getAdminToken();

    const body: any = {
      status,
    };
    
    if (rejectionReason) {
      body.rejectionReason = rejectionReason;
    }
    
    // ✅ Include exact details when verifying
    if (status === 'verified' && exactDetails) {
      if (exactDetails.exactAadhaarNumber) {
        body.exactAadhaarNumber = exactDetails.exactAadhaarNumber;
      }
      if (exactDetails.exactPANNumber) {
        body.exactPANNumber = exactDetails.exactPANNumber;
      }
      if (exactDetails.exactAddressDetails) {
        body.exactAddressDetails = exactDetails.exactAddressDetails;
      }
    }

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/${leadId}/documents/${documentIndex}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to verify document' }));
      throw new Error(error.error || error.message || 'Failed to verify document');
    }

    return response.json();
  },

  /**
   * Delete document
   */
  async deleteDocument(leadId: string, documentIndex: number): Promise<{ success: boolean; data: Lead; message: string }> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/${leadId}/documents/${documentIndex}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to delete document' }));
      throw new Error(error.error || error.message || 'Failed to delete document');
    }

    return response.json();
  },

  /**
   * Add skill
   */
  async addSkill(
    leadId: string,
    skill: { name: string; category?: string; level?: 'beginner' | 'experienced'; toolsAvailable?: boolean }
  ): Promise<{ success: boolean; data: Lead; message: string }> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/${leadId}/skills`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(skill),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to add skill' }));
      throw new Error(error.error || error.message || 'Failed to add skill');
    }

    return response.json();
  },

  /**
   * Update skill
   */
  async updateSkill(
    leadId: string,
    skillIndex: number,
    skill: Partial<{ name: string; category?: string; level?: 'beginner' | 'experienced'; toolsAvailable?: boolean }>
  ): Promise<{ success: boolean; data: Lead; message: string }> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/${leadId}/skills/${skillIndex}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(skill),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to update skill' }));
      throw new Error(error.error || error.message || 'Failed to update skill');
    }

    return response.json();
  },

  /**
   * Remove skill
   */
  async removeSkill(leadId: string, skillIndex: number): Promise<{ success: boolean; data: Lead; message: string }> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/${leadId}/skills/${skillIndex}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to remove skill' }));
      throw new Error(error.error || error.message || 'Failed to remove skill');
    }

    return response.json();
  },

  /**
   * Get approval queue
   */
  async getApprovalQueue(params?: { city?: string; primarySkill?: string; page?: number; limit?: number }): Promise<{
    success: boolean;
    data: {
      leads: Array<Lead & { approvalCriteria?: any }>;
      total: number;
      page: number;
      limit: number;
    };
  }> {
    const token = await getAdminToken();

    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/approval-queue?${queryParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch approval queue' }));
      throw new Error(error.error || error.message || 'Failed to fetch approval queue');
    }

    return response.json();
  },

  /**
   * Check approval criteria
   */
  async checkApprovalCriteria(leadId: string): Promise<{ success: boolean; data: any }> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/${leadId}/approval-criteria`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to check approval criteria' }));
      throw new Error(error.error || error.message || 'Failed to check approval criteria');
    }

    return response.json();
  },

  /**
   * Approve lead
   */
  async approveLead(leadId: string, notes?: string): Promise<{ success: boolean; data: Lead; message: string }> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/${leadId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to approve lead' }));
      throw new Error(error.error || error.message || 'Failed to approve lead');
    }

    return response.json();
  },

  /**
   * Bulk approve leads
   */
  async bulkApproveLeads(leadIds: string[], notes?: string): Promise<{
    success: boolean;
    data: {
      success: number;
      failed: number;
      total: number;
      successIds: string[];
      failedDetails: Array<{ leadId: string; error: string }>;
    };
    message: string;
  }> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/bulk-approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ leadIds, notes }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to bulk approve leads' }));
      throw new Error(error.error || error.message || 'Failed to bulk approve leads');
    }

    return response.json();
  },

  /**
   * Get interested candidates queue
   * registrationStatus: not_registered | registered | registered_verified
   */
  async getInterestedCandidates(params?: { city?: string; primarySkill?: string; search?: string; page?: number; limit?: number; registrationStatus?: 'not_registered' | 'registered' | 'registered_verified'; addedBy?: string }): Promise<{
    success: boolean;
    data: {
      leads: Lead[];
      total: number;
      page: number;
      limit: number;
    };
  }> {
    const token = await getAdminToken();

    const queryParams = new URLSearchParams();
    queryParams.append('status', 'contacted_interested');
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads?${queryParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch interested candidates' }));
      throw new Error(error.error || error.message || 'Failed to fetch interested candidates');
    }

    const result = await response.json();
    return {
      success: result.success,
      data: {
        leads: result.data || [],
        total: result.pagination?.total || 0,
        page: result.pagination?.page || 1,
        limit: result.pagination?.limit || 20,
      },
    };
  },

  /**
   * Get contacted & not interested candidates queue
   */
  async getNotInterestedCandidates(params?: { city?: string; primarySkill?: string; page?: number; limit?: number; addedBy?: string }): Promise<{
    success: boolean;
    data: {
      leads: Lead[];
      total: number;
      page: number;
      limit: number;
    };
  }> {
    const token = await getAdminToken();

    const queryParams = new URLSearchParams();
    queryParams.append('status', 'contacted_not_interested');
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads?${queryParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch not interested candidates' }));
      throw new Error(error.error || error.message || 'Failed to fetch not interested candidates');
    }

    const result = await response.json();
    return {
      success: result.success,
      data: {
        leads: result.data || [],
        total: result.pagination?.total || 0,
        page: result.pagination?.page || 1,
        limit: result.pagination?.limit || 20,
      },
    };
  },

  async getNotLiftedCandidates(params?: { city?: string; primarySkill?: string; page?: number; limit?: number; addedBy?: string }): Promise<{
    success: boolean;
    data: {
      leads: Lead[];
      total: number;
      page: number;
      limit: number;
    };
  }> {
    const token = await getAdminToken();

    const queryParams = new URLSearchParams();
    queryParams.append('status', 'contacted_not_lifted');
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads?${queryParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch not lifted candidates' }));
      throw new Error(error.error || error.message || 'Failed to fetch not lifted candidates');
    }

    const result = await response.json();
    return {
      success: result.success,
      data: {
        leads: result.data || [],
        total: result.pagination?.total || 0,
        page: result.pagination?.page || 1,
        limit: result.pagination?.limit || 20,
      },
    };
  },

  /**
   * Get activation queue
   */
  async getActivationQueue(params?: { city?: string; primarySkill?: string; page?: number; limit?: number }): Promise<{
    success: boolean;
    data: {
      leads: Lead[];
      total: number;
      page: number;
      limit: number;
    };
  }> {
    const token = await getAdminToken();

    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/activation-queue?${queryParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch activation queue' }));
      throw new Error(error.error || error.message || 'Failed to fetch activation queue');
    }

    return response.json();
  },

  /**
   * Activate lead
   */
  async activateLead(leadId: string): Promise<{
    success: boolean;
    data: { firebaseUid: string; profileCreated: boolean };
    message: string;
  }> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/${leadId}/activate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to activate lead' }));
      throw new Error(error.error || error.message || 'Failed to activate lead');
    }

    return response.json();
  },

  /**
   * Bulk activate leads
   */
  async bulkActivateLeads(leadIds: string[]): Promise<{
    success: boolean;
    data: {
      success: Array<{ leadId: string; firebaseUid: string; profileCreated: boolean }>;
      failed: Array<{ leadId: string; error: string }>;
    };
    message: string;
  }> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/bulk-activate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ leadIds }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to bulk activate leads' }));
      throw new Error(error.error || error.message || 'Failed to bulk activate leads');
    }

    return response.json();
  },

  /**
   * Get verification queue - leads with pending documents
   */
  async getVerificationQueue(params: {
    documentType?: Lead['documents'][0]['type'];
    status?: LeadStatus;
    city?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    success: boolean;
    data: {
      leads: Array<Lead & {
        pendingDocuments: Array<{
          index: number;
          type: Lead['documents'][0]['type'];
          url?: string;
          uploadedAt?: string;
        }>;
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

    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value));
      }
    });

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/verification-queue?${queryParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch verification queue' }));
      throw new Error(error.error || error.message || 'Failed to fetch verification queue');
    }

    return response.json();
  },

  /**
   * Initiate Aadhaar verification (sends OTP)
   */
  async initiateAadhaarVerification(
    leadId: string,
    documentIndex: number,
    aadhaarNumber: string
  ): Promise<{
    success: boolean;
    data: {
      refId: string;
      transactionId?: string;
      maskedAadhaar?: string;
      testOtp?: string;
      message: string;
    };
  }> {
    const token = await getAdminToken();

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/${leadId}/documents/${documentIndex}/verify-aadhaar/initiate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ aadhaarNumber }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to initiate Aadhaar verification' }));
      throw new Error(error.error || error.message || 'Failed to initiate Aadhaar verification');
    }

    return response.json();
  },

  /**
   * Verify Aadhaar OTP
   */
  async verifyAadhaarOTP(
    leadId: string,
    documentIndex: number,
    refId: string,
    otp: string,
    aadhaarNumber: string
  ): Promise<{
    success: boolean;
    data: {
      lead: Lead;
      verification: {
        verified: boolean;
        maskedAadhaar?: string;
        verifiedData?: any;
      };
      addressExtracted: boolean;
    };
    message: string;
  }> {
    const token = await getAdminToken();

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/${leadId}/documents/${documentIndex}/verify-aadhaar/verify`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refId, otp, aadhaarNumber }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to verify Aadhaar OTP' }));
      throw new Error(error.error || error.message || 'Failed to verify Aadhaar OTP');
    }

    return response.json();
  },

  /**
   * Verify PAN via Cashfree API
   */
  async verifyPAN(
    leadId: string,
    documentIndex: number,
    panNumber: string
  ): Promise<{
    success: boolean;
    data: {
      lead: Lead;
      verification: {
        verified: boolean;
        maskedPAN?: string;
        verifiedData?: any;
      };
    };
    message: string;
  }> {
    const token = await getAdminToken();

    const response = await fetch(
      `${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/${leadId}/documents/${documentIndex}/verify-pan`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ panNumber }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to verify PAN' }));
      throw new Error(error.error || error.message || 'Failed to verify PAN');
    }

    return response.json();
  },

  /**
   * Delete a lead
   */
  async deleteLead(leadId: string): Promise<{ success: boolean; message: string }> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/${leadId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to delete lead' }));
      throw new Error(error.error || error.message || 'Failed to delete lead');
    }

    return response.json();
  },

  /**
   * Bulk delete leads
   */
  async bulkDeleteLeads(leadIds: string[]): Promise<{
    success: boolean;
    data: {
      success: number;
      failed: number;
      errors: Array<{ leadId: string; error: string }>;
    };
    message: string;
  }> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/bulk-delete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ leadIds }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to bulk delete leads' }));
      throw new Error(error.error || error.message || 'Failed to bulk delete leads');
    }

    return response.json();
  },

  /**
   * Get list of lead creators (users who have created leads)
   */
  async getLeadCreators(): Promise<{ success: boolean; data: Array<{ userId: string; name: string }> }> {
    const token = await getAdminToken();

    const response = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/leads/creators`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch lead creators' }));
      throw new Error(error.error || error.message || 'Failed to fetch lead creators');
    }

    return response.json();
  },
};

