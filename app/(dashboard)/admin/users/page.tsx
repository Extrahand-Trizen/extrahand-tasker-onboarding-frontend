'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userManagementApi, type AdminUser, type Session } from '@/lib/api/userManagement';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Key, Monitor, Trash2, RefreshCw, User, Mail, Calendar, Shield } from 'lucide-react';

const ROLES = ['admin', 'operations', 'marketing', 'support', 'trust'] as const;
const STATUSES = ['active', 'suspended', 'inactive'] as const;

export default function UserManagementPage() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [editRole, setEditRole] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', filterStatus, filterRole, search],
    queryFn: () => userManagementApi.list({
      status: filterStatus !== 'all' ? filterStatus : undefined,
      role: filterRole !== 'all' ? filterRole : undefined,
      search: search || undefined,
    }),
  });

  // Fetch detailed user info when modal opens
  const { data: userDetails, refetch: refetchUserDetails } = useQuery({
    queryKey: ['admin-user-details', selectedUser?.userId],
    queryFn: () => userManagementApi.getById(selectedUser!.userId),
    enabled: !!selectedUser && detailsDialogOpen,
  });

  // Fetch sessions
  const { data: sessionsData, refetch: refetchSessions } = useQuery({
    queryKey: ['admin-user-sessions', selectedUser?.userId],
    queryFn: () => userManagementApi.getSessions(selectedUser!.userId),
    enabled: !!selectedUser && detailsDialogOpen,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      userManagementApi.updateRole(userId, role),
    onSuccess: () => {
      toast.success('User role updated');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      refetchUserDetails();
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update role'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      userManagementApi.updateStatus(userId, status),
    onSuccess: () => {
      toast.success('User status updated');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      refetchUserDetails();
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update status'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (userId: string) => userManagementApi.resetPassword(userId),
    onSuccess: (data) => {
      if (data.data?.emailSent) {
        toast.success(`Password reset email sent to ${data.data.email || 'user'}`, {
          description: `The reset link expires on ${data.data.expiresAt ? new Date(data.data.expiresAt).toLocaleString() : '24 hours'}`,
        });
      } else if (data.data?.resetLink) {
        // Email failed but we have the reset link - show it prominently
        toast.warning('Email sending failed, but reset link generated', {
          description: `Email: ${data.data.email || 'N/A'}. Link: ${data.data.resetLink}`,
          duration: 10000, // Show for 10 seconds
        });
        // Also log to console for easy copying
        console.warn('Password reset link (email failed):', data.data.resetLink);
      } else {
        toast.info('Password reset initiated', {
          description: data.message || 'Check server logs for details',
        });
      }
    },
    onError: (e: any) => {
      const errorMessage = e.message || 'Failed to reset password';
      // If we have a reset link in the error data, show it
      if (e.data?.resetLink) {
        toast.error(errorMessage, {
          description: `Email: ${e.data.email || 'N/A'}. Reset link: ${e.data.resetLink}`,
          duration: 15000, // Show for 15 seconds
        });
        console.error('Password reset link (error occurred):', e.data.resetLink);
      } else {
        toast.error(errorMessage, {
          description: e.data?.email ? `User email: ${e.data.email}` : undefined,
        });
      }
    },
  });

  const revokeSessionMutation = useMutation({
    mutationFn: ({ userId, sessionIndex }: { userId: string; sessionIndex: number }) =>
      userManagementApi.revokeSession(userId, sessionIndex),
    onSuccess: () => {
      toast.success('Session revoked');
      refetchSessions();
      refetchUserDetails();
    },
    onError: (e: any) => toast.error(e.message || 'Failed to revoke session'),
  });

  const revokeAllSessionsMutation = useMutation({
    mutationFn: (userId: string) => userManagementApi.revokeAllSessions(userId),
    onSuccess: () => {
      toast.success('All sessions revoked');
      refetchSessions();
      refetchUserDetails();
    },
    onError: (e: any) => toast.error(e.message || 'Failed to revoke sessions'),
  });

  const handleViewDetails = (user: AdminUser) => {
    setSelectedUser(user);
    setEditRole(user.role);
    setEditStatus(user.status);
    setDetailsDialogOpen(true);
  };

  const handleSave = () => {
    if (!selectedUser) return;

    const promises = [];
    if (editRole !== selectedUser.role) {
      promises.push(updateRoleMutation.mutateAsync({ userId: selectedUser.userId, role: editRole }));
    }
    if (editStatus !== selectedUser.status) {
      promises.push(updateStatusMutation.mutateAsync({ userId: selectedUser.userId, status: editStatus }));
    }

    Promise.all(promises);
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, string> = {
      admin: 'bg-red-100 text-red-800',
      operations: 'bg-blue-100 text-blue-800',
      marketing: 'bg-purple-100 text-purple-800',
      support: 'bg-green-100 text-green-800',
      trust: 'bg-yellow-100 text-yellow-800',
    };
    return variants[role] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      suspended: 'bg-red-100 text-red-800',
      inactive: 'bg-gray-100 text-gray-800',
    };
    return variants[status] || 'bg-gray-100 text-gray-800';
  };

  const user = userDetails?.data || selectedUser;
  const sessions = sessionsData?.data || [];

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">User Management</h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          Manage admin users, update roles, and control access
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-sm">Search</Label>
              <Input
                placeholder="Search by email or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Filter by Role</Label>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role} className="capitalize">
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Filter by Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status} className="capitalize">
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Users</CardTitle>
          <CardDescription>
            {data?.data?.length || 0} user(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Login Count</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.data?.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell className="font-mono text-sm">{user.email}</TableCell>
                      <TableCell>{user.name || '-'}</TableCell>
                      <TableCell>
                        <Badge className={getRoleBadge(user.role)}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.team || '-'}</TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(user.status)}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleDateString()
                          : 'Never'}
                      </TableCell>
                      <TableCell>{user.loginCount || 0}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(user)}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              Complete profile and management for {user?.email}
            </DialogDescription>
          </DialogHeader>

          {user && (
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="sessions">Sessions ({sessions.length})</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              {/* Profile Tab */}
              <TabsContent value="profile" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Email</Label>
                    <p className="text-sm font-medium">{user.email}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Name</Label>
                    <p className="text-sm font-medium">{user.name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Role</Label>
                    <div className="mt-1">
                      <Select value={editRole} onValueChange={setEditRole}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((role) => (
                            <SelectItem key={role} value={role} className="capitalize">
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Status</Label>
                    <div className="mt-1">
                      <Select value={editStatus} onValueChange={setEditStatus}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((status) => (
                            <SelectItem key={status} value={status} className="capitalize">
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Team</Label>
                    <p className="text-sm font-medium">{user.team || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Department</Label>
                    <p className="text-sm font-medium">{user.department || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Joined Via</Label>
                    <p className="text-sm font-medium capitalize">{user.joinedVia || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Account Created</Label>
                    <p className="text-sm font-medium">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                    </p>
                  </div>
                  {user.inviteInfo && (
                    <>
                      <div>
                        <Label className="text-xs text-gray-500">Invite Email</Label>
                        <p className="text-sm font-medium">{user.inviteInfo.email}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Invite Accepted</Label>
                        <p className="text-sm font-medium">
                          {user.inviteInfo.usedAt
                            ? new Date(user.inviteInfo.usedAt).toLocaleDateString()
                            : 'Not accepted'}
                        </p>
                      </div>
                    </>
                  )}
                  <div>
                    <Label className="text-xs text-gray-500">Last Login</Label>
                    <p className="text-sm font-medium">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleString()
                        : 'Never'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Login Count</Label>
                    <p className="text-sm font-medium">{user.loginCount || 0}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={handleSave}
                    disabled={updateRoleMutation.isPending || updateStatusMutation.isPending}
                  >
                    Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => resetPasswordMutation.mutate(user.userId)}
                    disabled={resetPasswordMutation.isPending}
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Reset Password
                  </Button>
                </div>
              </TabsContent>

              {/* Sessions Tab */}
              <TabsContent value="sessions" className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    {sessions.length} active session(s)
                  </p>
                  {sessions.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => revokeAllSessionsMutation.mutate(user.userId)}
                      disabled={revokeAllSessionsMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Revoke All
                    </Button>
                  )}
                </div>

                {sessions.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No active sessions</p>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((session, index) => (
                      <Card key={index}>
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Monitor className="h-4 w-4 text-gray-400" />
                                <p className="text-sm font-medium">{session.deviceInfo}</p>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>IP: {session.ipAddress}</span>
                                <span>•</span>
                                <span>
                                  Created: {new Date(session.createdAt).toLocaleString()}
                                </span>
                              </div>
                              {session.lastUsedAt && (
                                <p className="text-xs text-gray-500">
                                  Last used: {new Date(session.lastUsedAt).toLocaleString()}
                                </p>
                              )}
                              <p className="text-xs text-gray-500">
                                Expires: {new Date(session.expiresAt).toLocaleString()}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                revokeSessionMutation.mutate({
                                  userId: user.userId,
                                  sessionIndex: index,
                                })
                              }
                              disabled={revokeSessionMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Activity Tab */}
              <TabsContent value="activity" className="space-y-4">
                {user.activityTimeline && user.activityTimeline.length > 0 ? (
                  <div className="space-y-4">
                    {user.activityTimeline.map((activity, index) => (
                      <div key={index} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-amber-500 mt-1" />
                          {index < user.activityTimeline!.length - 1 && (
                            <div className="w-0.5 h-full bg-gray-200 mt-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="text-sm font-medium">{activity.description}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(activity.date).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">No activity recorded</p>
                )}
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
