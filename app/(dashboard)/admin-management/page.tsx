'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invitesApi, type AdminInvite, type CreateInviteRequest } from '@/lib/api/invites';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';

const ALL_ROLES = ['admin', 'onboarder', 'qualifier', 'lead_access_manager'] as const;

export default function AdminManagementPage() {
  const qc = useQueryClient();
  const { role: currentUserRole } = useJWTAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'onboarder' | 'qualifier' | 'lead_access_manager'>('onboarder');
  
  // ✅ Lead Access Manager can only create invites for Qualifier and Onboarder
  const availableRoles = currentUserRole === 'lead_access_manager' 
    ? ['qualifier', 'onboarder'] as const
    : ALL_ROLES;
  const [team, setTeam] = useState('');
  const [department, setDepartment] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-invites', filterStatus],
    queryFn: () => invitesApi.list(filterStatus !== 'all' ? { status: filterStatus } : undefined),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateInviteRequest) => invitesApi.create(payload),
    onSuccess: (response) => {
      toast.success('Invite created and email sent!');
      
      // Copy invite link to clipboard
      invitesApi.copyInviteLink(response.data.inviteLink)
        .then(() => {
          toast.info('Invite link copied to clipboard');
        })
        .catch(() => {
          toast.info(`Invite link: ${response.data.inviteLink}`);
        });

      // Reset form
      setEmail('');
      setRole('onboarder');
      setTeam('');
      setDepartment('');
      
      qc.invalidateQueries({ queryKey: ['admin-invites'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create invite'),
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => invitesApi.revoke(inviteId),
    onSuccess: () => {
      toast.success('Invite revoked');
      qc.invalidateQueries({ queryKey: ['admin-invites'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to revoke invite'),
  });

  const resendMutation = useMutation({
    mutationFn: (inviteId: string) => invitesApi.resend(inviteId),
    onSuccess: (response) => {
      toast.success('Invite resent!');
      
      // Copy new invite link
      invitesApi.copyInviteLink(response.data.inviteLink)
        .then(() => {
          toast.info('New invite link copied to clipboard');
        })
        .catch(() => {});
      
      qc.invalidateQueries({ queryKey: ['admin-invites'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to resend invite'),
  });

  const invites: AdminInvite[] = data?.data || [];

  const handleCreateInvite = () => {
    if (!email) {
      toast.error('Email is required');
      return;
    }

    createMutation.mutate({
      email,
      role,
      team: team || undefined,
      department: department || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      expired: 'bg-gray-100 text-gray-800',
      revoked: 'bg-red-100 text-red-800',
    };
    return variants[status] || 'bg-gray-100 text-gray-800';
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-800',
      onboarder: 'bg-blue-100 text-blue-800',
      qualifier: 'bg-pink-100 text-pink-800',
      lead_access_manager: 'bg-indigo-100 text-indigo-800',
      support: 'bg-green-100 text-green-800',
      trust: 'bg-amber-100 text-amber-800',
    };
    return variants[role] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Admin Management</h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          Create invites for new admin users. They'll receive an email with a link to join.
        </p>
      </div>

      {/* Create Invite Card */}
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">Create Admin Invite</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Send an invite email to a new admin user. They can login with any Microsoft account.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="text-sm"
              />
              <p className="text-xs text-gray-500">For notification only</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Role *</Label>
              <Select value={role} onValueChange={(v: any) => setRole(v)}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((r) => (
                    <SelectItem key={r} value={r} className="text-sm capitalize">
                      {r === 'lead_access_manager' ? 'Lead Access Manager' : r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Team (Optional)</Label>
              <Input
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                placeholder="Onboarding Team"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Department (Optional)</Label>
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Operations"
                className="text-sm"
              />
            </div>
          </div>

          <Button
            onClick={handleCreateInvite}
            disabled={createMutation.isPending || !email}
            className="w-full sm:w-auto"
          >
            {createMutation.isPending ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Invite...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create & Send Invite
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Invites List */}
      <Card>
        <CardHeader className="px-4 sm:px-6 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg sm:text-xl">Admin Invites</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              View and manage all admin invites
            </CardDescription>
          </div>
          <div className="w-40">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Loading invites...</p>
            </div>
          ) : invites.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No invites found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Team</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">Used By</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Created</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((invite) => (
                    <TableRow key={invite.inviteId}>
                      <TableCell className="text-xs font-mono">{invite.email}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${getRoleBadge(invite.role)}`}>
                          {invite.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs hidden md:table-cell">
                        {invite.team || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${getStatusBadge(invite.status)}`}>
                          {invite.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs hidden lg:table-cell">
                        {invite.usedByName ? (
                          <div>
                            <div className="font-medium">{invite.usedByName}</div>
                            <div className="text-xs text-gray-500 font-mono">{invite.usedByEmail}</div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-xs hidden sm:table-cell">
                        {new Date(invite.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {invite.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resendMutation.mutate(invite.inviteId)}
                                disabled={resendMutation.isPending}
                                className="text-xs"
                              >
                                Resend
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => revokeMutation.mutate(invite.inviteId)}
                                disabled={revokeMutation.isPending}
                                className="text-xs"
                              >
                                Revoke
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
