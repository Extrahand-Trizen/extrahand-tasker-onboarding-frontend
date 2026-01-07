'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminUsersApi, type AdminRole, type AdminUser } from '@/lib/api/admin-users';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const ROLES: AdminRole[] = ['admin', 'operations', 'marketing', 'support', 'trust'];

export default function AdminManagementPage() {
  const qc = useQueryClient();
  const [uid, setUid] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('marketing');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminUsersApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => adminUsersApi.create({ uid, email, role }),
    onSuccess: () => {
      toast.success('Admin added');
      setUid('');
      setEmail('');
      setRole('marketing');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ uid, role }: { uid: string; role: AdminRole }) => adminUsersApi.updateRole(uid, role),
    onSuccess: () => {
      toast.success('Role updated. User should re-login to apply.');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetMutation = useMutation({
    mutationFn: (uid: string) => adminUsersApi.resetPassword(uid),
    onSuccess: (resp: any) => {
      const link = resp?.data?.resetLink;
      if (link) {
        navigator.clipboard.writeText(link).catch(() => {});
        toast.success('Reset link copied to clipboard');
      } else {
        toast.success('Reset link generated');
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const admins: AdminUser[] = data?.data || [];

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Admin Management</h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">Create admins, assign roles, reset passwords</p>
      </div>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">Add Admin</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 px-4 sm:px-6">
          <div className="space-y-2">
            <Label>Firebase UID</Label>
            <Input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="uid..." />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email..." />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AdminRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 md:col-span-3">
            <Button 
              onClick={() => createMutation.mutate()} 
              disabled={createMutation.isPending || !uid || !email}
              className="w-full sm:w-auto"
            >
              {createMutation.isPending ? 'Saving...' : 'Add Admin'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">Admin Users</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {isLoading ? (
            <p className="text-xs sm:text-sm text-gray-600">Loading...</p>
          ) : admins.length === 0 ? (
            <p className="text-xs sm:text-sm text-gray-600">No admin users yet.</p>
          ) : (
            <div className="space-y-3">
              {admins.map((a) => (
                <div key={a.uid} className="border rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <div className="font-medium">{a.email}</div>
                    <div className="text-xs text-gray-500">UID: {a.uid}</div>
                    <div className="text-xs text-gray-500">Status: {a.status}</div>
                    {a.createdAt && (
                      <div className="text-xs text-gray-500">Created: {new Date(a.createdAt).toLocaleString()}</div>
                    )}
                  </div>

                  <Select
                    value={a.role}
                    onValueChange={(v) => updateRoleMutation.mutate({ uid: a.uid, role: v as AdminRole })}
                  >
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button 
                    variant="outline" 
                    onClick={() => resetMutation.mutate(a.uid)}
                    className="w-full sm:w-auto text-xs sm:text-sm"
                  >
                    Reset password (copy link)
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

