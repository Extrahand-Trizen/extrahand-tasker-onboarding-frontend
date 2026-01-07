'use client';

// import { caosApi } from './caos';

// Reuse admin token logic from caosApi
async function getAdminToken(): Promise<string> {
  if (typeof window === 'undefined') throw new Error('Admin token can only be retrieved on client side');
  const { auth } = await import('@/lib/config/firebase');
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

const ADMIN_SERVICE_URL = process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL;
if (!ADMIN_SERVICE_URL) {
  throw new Error('NEXT_PUBLIC_ADMIN_SERVICE_URL environment variable is required');
}

export type AdminRole = 'admin' | 'operations' | 'marketing' | 'support' | 'trust';

export interface AdminUser {
  _id: string;
  uid: string;
  email: string;
  role: AdminRole;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  lastRoleChangeBy?: string;
  lastRoleChangeAt?: string;
}

export const adminUsersApi = {
  async list(): Promise<{ success: boolean; data: AdminUser[] }> {
    const token = await getAdminToken();
    const res = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/team`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch admin users');
    }
    return res.json();
  },

  async create(payload: { uid: string; email: string; role: AdminRole }) {
    const token = await getAdminToken();
    const res = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/team`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create admin user');
    }
    return res.json();
  },

  async updateRole(uid: string, role: AdminRole) {
    const token = await getAdminToken();
    const res = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/team/${uid}/role`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update role');
    }
    return res.json();
  },

  async resetPassword(uid: string) {
    const token = await getAdminToken();
    const res = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/team/${uid}/reset-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to reset password');
    }
    return res.json();
  },
};

