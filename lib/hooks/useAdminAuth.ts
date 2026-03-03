'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged, User, getIdTokenResult } from 'firebase/auth';
import { auth } from '@/lib/config/firebase';

export function useAdminAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        const tokenResult = await getIdTokenResult(firebaseUser);
        const claimRole = (tokenResult?.claims as any)?.role as string | undefined;
        localStorage.setItem('adminToken', token);
        setUser(firebaseUser);
        setRole(claimRole || null);
      } else {
        localStorage.removeItem('adminToken');
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    if (!auth) {
      return { success: false, error: 'Firebase is not configured. Use JWT login.' };
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken();
      const tokenResult = await getIdTokenResult(userCredential.user);
      const claimRole = (tokenResult?.claims as any)?.role as string | undefined;
      localStorage.setItem('adminToken', token);
      setUser(userCredential.user);
      setRole(claimRole || null);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    if (!auth) {
      localStorage.removeItem('adminToken');
      setUser(null);
      setRole(null);
      router.push('/login');
      return;
    }
    try {
      await firebaseSignOut(auth);
      localStorage.removeItem('adminToken');
      setUser(null);
      setRole(null);
      router.push('/login');
    } catch (error: any) {
      console.error('Logout error:', error);
    }
  };

  return {
    user,
    loading,
    isAuthenticated: !!user,
    role,
    login,
    logout,
  };
}

