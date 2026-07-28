'use client';

import { useState, useEffect, useRef } from 'react';
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
import { 
  Clock, 
  Key, 
  Monitor, 
  Trash2, 
  RefreshCw, 
  User, 
  Mail, 
  Calendar, 
  Shield,
  ChevronUp,
  ChevronDown,
  MoreVertical,
  Users,
  UserCheck,
  UserX,
  TrendingUp,
  BarChart3
} from 'lucide-react';

const ROLES = ['lead_access_manager', 'onboarder', 'qualifier'] as const;
const STATUSES = ['active', 'suspended', 'inactive'] as const;

type SortField = 'email' | 'name' | 'createdAt' | 'lastLoginAt' | 'role' | 'status';
type SortDir = 'asc' | 'desc';

type DeleteStep =
  | 'idle'
  | 'checking'
  | 'transfer_needed'
  | 'transferring'
  | 'no_transfer'
  | 'deleting'
  | 'error';

interface DeleteSummary {
  role: string;
  leadsAddedCount: number;
  leadsPickedCount: number;
  contactedCount: number;
  interestedCount: number;
  followupsCount: number;
  totalAssignments: number;
  hasAssignments: boolean;
  remainingActiveAdmins: Array<{ userId: string; name: string; email: string }>;
  canDelete: boolean;
}

export default function UserManagementPage() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [sort, setSort] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [editRole, setEditRole] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('');
  const [showQuickActions, setShowQuickActions] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const quickActionsRef = useRef<HTMLDivElement>(null);

  // ── Delete flow ──────────────────────────────────────────────────────────
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [deleteStep, setDeleteStep] = useState<DeleteStep>('idle');
  const [deleteSummary, setDeleteSummary] = useState<DeleteSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Close quick actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.quick-actions-container')) {
        setShowQuickActions(null);
      }
    };

    if (showQuickActions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showQuickActions]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', filterStatus, filterRole, search, page, limit, sort, sortDir],
    queryFn: () => userManagementApi.list({
      status: filterStatus !== 'all' ? filterStatus : undefined,
      role: filterRole !== 'all' ? filterRole : undefined,
      search: search || undefined,
      page,
      limit,
      sort,
      dir: sortDir,
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
      setShowQuickActions(null);
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
      setShowQuickActions(null);
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
        toast.warning('Email sending failed, but reset link generated', {
          description: `Email: ${data.data.email || 'N/A'}. Link: ${data.data.resetLink}`,
          duration: 10000,
        });
        console.warn('Password reset link (email failed):', data.data.resetLink);
      } else {
        toast.info('Password reset initiated', {
          description: data.message || 'Check server logs for details',
        });
      }
      setShowQuickActions(null);
    },
    onError: (e: any) => {
      const errorMessage = e.message || 'Failed to reset password';
      if (e.data?.resetLink) {
        toast.error(errorMessage, {
          description: `Email: ${e.data.email || 'N/A'}. Reset link: ${e.data.resetLink}`,
          duration: 15000,
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

  // useEffect: fetch assignments summary whenever the delete dialog opens
  useEffect(() => {
    if (!deleteDialogOpen || !deleteUser) return;
    console.log('[Delete Flow useEffect] Dialog opened for user:', deleteUser);
    setDeleteStep('checking');
    setDeleteSummary(null);
    setDeleteError(null);

    userManagementApi.getAssignmentsSummary(deleteUser.userId)
      .then((res) => {
        console.log('[Delete Flow useEffect] Received summary data:', res.data);
        setDeleteSummary(res.data);
        setDeleteStep(res.data.hasAssignments ? 'transfer_needed' : 'no_transfer');
      })
      .catch((err: any) => {
        console.error('[Delete Flow useEffect] Error fetching summary:', err);
        setDeleteError(err.message || 'Failed to check assignments. Please try again.');
        setDeleteStep('error');
      });
  }, [deleteDialogOpen, deleteUser]);

  const handleDeleteClick = (user: AdminUser) => {
    console.log('[handleDeleteClick invoked] Target user:', user);
    setShowQuickActions(null);
    setDeleteUser(user);
    setDeleteStep('idle');
    setDeleteSummary(null);
    setDeleteError(null);
    setDeleteDialogOpen(true); // open dialog immediately — data loads inside via useEffect
  };

  const handleTransferAndProceed = async () => {
    if (!deleteUser) return;
    console.log('[handleTransferAndProceed invoked] Target user:', deleteUser);
    setDeleteStep('transferring');
    try {
      const res = await userManagementApi.transferAndDelete(deleteUser.userId);
      console.log('[handleTransferAndProceed success] Result:', res);
      toast.success('All assignments transferred and account deleted successfully');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setDeleteDialogOpen(false);
      setDeleteUser(null);
    } catch (err: any) {
      console.error('[handleTransferAndProceed error]:', err);
      toast.error(err.message || 'Failed to transfer and delete user');
      setDeleteStep('transfer_needed');
    }
  };

  const handleFinalDelete = async () => {
    if (!deleteUser) return;
    console.log('[handleFinalDelete invoked] Target user:', deleteUser);
    setDeleteStep('deleting');
    try {
      const res = await userManagementApi.delete(deleteUser.userId);
      console.log('[handleFinalDelete success] Result:', res);
      toast.success('User account deleted successfully');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setDeleteDialogOpen(false);
      setDeleteUser(null);
    } catch (err: any) {
      console.error('[handleFinalDelete error]:', err);
      toast.error(err.message || 'Failed to delete user');
      setDeleteStep('no_transfer');
    }
  };

  const closeDeleteDialog = () => {
    if (deleteStep === 'transferring' || deleteStep === 'deleting') return; // block close while busy
    console.log('[closeDeleteDialog invoked]');
    setDeleteDialogOpen(false);
    setDeleteUser(null);
    setDeleteStep('idle');
    setDeleteSummary(null);
    setDeleteError(null);
  };


  const handleViewDetails = (user: AdminUser) => {
    setSelectedUser(user);
    setEditRole(user.role);
    setEditStatus(user.status);
    setDetailsDialogOpen(true);
    setShowQuickActions(null);
  };

  const handleSort = (field: SortField) => {
    if (sort === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(field);
      setSortDir('desc');
    }
  };

  const handleQuickAction = (action: 'suspend' | 'activate' | 'resetPassword', user: AdminUser) => {
    setShowQuickActions(null);
    if (action === 'suspend') {
      updateStatusMutation.mutate({ userId: user.userId, status: 'suspended' });
    } else if (action === 'activate') {
      updateStatusMutation.mutate({ userId: user.userId, status: 'active' });
    } else if (action === 'resetPassword') {
      resetPasswordMutation.mutate(user.userId);
    }
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
      lead_access_manager: 'bg-red-100 text-red-800',
      onboarder: 'bg-blue-100 text-blue-800',
      qualifier: 'bg-purple-100 text-purple-800',
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

  const getLastActiveText = (lastLoginAt?: string) => {
    if (!lastLoginAt) return { text: 'Never', color: 'text-gray-500' };
    const daysAgo = Math.floor((Date.now() - new Date(lastLoginAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysAgo === 0) return { text: 'Today', color: 'text-green-600' };
    if (daysAgo === 1) return { text: 'Yesterday', color: 'text-green-600' };
    if (daysAgo < 7) return { text: `${daysAgo} days ago`, color: 'text-yellow-600' };
    if (daysAgo < 30) return { text: `${daysAgo} days ago`, color: 'text-orange-600' };
    return { text: `${daysAgo} days ago`, color: 'text-red-600' };
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sort !== field) return <ChevronUp className="h-3 w-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const user = userDetails?.data || selectedUser;
  const sessions = sessionsData?.data || [];
  const users = data?.data || [];
  const pagination = data?.pagination;
  const stats = data?.stats;

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">User Management</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Manage admin users, update roles, and control access
          </p>
        </div>
        {stats && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAnalytics(!showAnalytics)}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            {showAnalytics ? 'Hide' : 'Show'} Analytics
          </Button>
        )}
      </div>

      {/* Quick Stats Cards */}
      {stats && showAnalytics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('all')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('active')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                </div>
                <UserCheck className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('suspended')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Suspended</p>
                  <p className="text-2xl font-bold text-red-600">{stats.suspended}</p>
                </div>
                <UserX className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">New This Month</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.newThisMonth}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-sm">Search</Label>
              <Input
                placeholder="Search by email or name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1); // Reset to first page on search
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Filter by Role</Label>
              <Select value={filterRole} onValueChange={(v) => { setFilterRole(v); setPage(1); }}>
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
              <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Admin Users</CardTitle>
              <CardDescription>
                {pagination ? (
                  <>Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} user(s)</>
                ) : (
                  <>{users.length} user(s) found</>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Per page:</Label>
              <Select value={limit.toString()} onValueChange={(v) => { setLimit(parseInt(v)); setPage(1); }}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No users found</p>
              {(filterStatus !== 'all' || filterRole !== 'all' || search) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setFilterStatus('all');
                    setFilterRole('all');
                    setSearch('');
                    setPage(1);
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('email')}>
                        <div className="flex items-center gap-1">
                          Email
                          <SortIcon field="email" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('name')}>
                        <div className="flex items-center gap-1">
                          Name
                          <SortIcon field="name" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('role')}>
                        <div className="flex items-center gap-1">
                          Role
                          <SortIcon field="role" />
                        </div>
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('createdAt')}>
                        <div className="flex items-center gap-1">
                          Created
                          <SortIcon field="createdAt" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('lastLoginAt')}>
                        <div className="flex items-center gap-1">
                          Last Active
                          <SortIcon field="lastLoginAt" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user, index) => {
                      const lastActive = getLastActiveText(user.lastLoginAt);
                      return (
                        <TableRow key={user.userId || user.email || `user-${index}`}>
                          <TableCell className="font-mono text-sm">{user.email}</TableCell>
                          <TableCell>{user.name || '-'}</TableCell>
                          <TableCell>
                            <Badge className={getRoleBadge(user.role)}>
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusBadge(user.status)}>
                              {user.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.createdAt
                              ? new Date(user.createdAt).toLocaleDateString()
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <span className={lastActive.color}>{lastActive.text}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewDetails(user)}
                              >
                                View
                              </Button>
                              <div className="relative quick-actions-container">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowQuickActions(showQuickActions === user.userId ? null : user.userId);
                                  }}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                                {showQuickActions === user.userId && (
                                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                                    <div className="py-1">
                                      <button
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                                        onClick={() => handleViewDetails(user)}
                                      >
                                        View Details
                                      </button>
                                      {user.status === 'active' ? (
                                        <button
                                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-red-600"
                                          onClick={() => handleQuickAction('suspend', user)}
                                        >
                                          Suspend User
                                        </button>
                                      ) : (
                                        <button
                                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-green-600"
                                          onClick={() => handleQuickAction('activate', user)}
                                        >
                                          Activate User
                                        </button>
                                      )}
                                      <button
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                                        onClick={() => handleQuickAction('resetPassword', user)}
                                      >
                                        Reset Password
                                      </button>
                                      <hr className="my-1 border-gray-200" />
                                      <button
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-700 font-medium"
                                        onMouseDown={(e) => {
                                          e.stopPropagation();
                                          console.log('[Delete User Button clicked onMouseDown]', user);
                                          handleDeleteClick(user);
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          console.log('[Delete User Button clicked onClick]', user);
                                          handleDeleteClick(user);
                                        }}
                                      >
                                        🗑 Delete User
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 mt-6 pt-4 border-t">
                  <div className="text-xs sm:text-sm text-gray-600">
                    Page {pagination.page} of {pagination.pages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={!pagination.hasPrev || isLoading}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={!pagination.hasNext || isLoading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
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

      {/* ── Delete Flow Dialog ─────────────────────────────────────── */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog();
        }}
      >
        <DialogContent className="max-w-lg">
          {/* Step: Checking */}
          {deleteStep === 'checking' && (
            <>
              <DialogHeader>
                <DialogTitle>Checking assignments…</DialogTitle>
                <DialogDescription>
                  Looking up leads and followups assigned to{' '}
                  <strong>{deleteUser?.name || deleteUser?.email}</strong>.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            </>
          )}

          {/* Step: Has assignments – show summary + transfer button */}
          {deleteStep === 'transfer_needed' && deleteSummary && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-red-500" />
                  Transfer & Delete — {deleteUser?.name || deleteUser?.email}
                </DialogTitle>
                <DialogDescription>
                  This user has active assignments. They must be redistributed equally before deleting.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Role */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">Role:</span>
                  <span className="capitalize text-sm font-semibold">{deleteSummary.role}</span>
                </div>

                {/* Counts */}
                <div className="grid grid-cols-2 gap-3">
                  {deleteSummary.leadsAddedCount > 0 && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-blue-600 font-medium">Leads Added</p>
                      <p className="text-2xl font-bold text-blue-700">{deleteSummary.leadsAddedCount}</p>
                    </div>
                  )}
                  {deleteSummary.leadsPickedCount > 0 && (
                    <div className="bg-purple-50 rounded-lg p-3">
                      <p className="text-xs text-purple-600 font-medium">Leads Picked</p>
                      <p className="text-2xl font-bold text-purple-700">{deleteSummary.leadsPickedCount}</p>
                    </div>
                  )}
                  {deleteSummary.contactedCount > 0 && (
                    <div className="bg-yellow-50 rounded-lg p-3">
                      <p className="text-xs text-yellow-600 font-medium">Contacted</p>
                      <p className="text-2xl font-bold text-yellow-700">{deleteSummary.contactedCount}</p>
                    </div>
                  )}
                  {deleteSummary.interestedCount > 0 && (
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-green-600 font-medium">Interested</p>
                      <p className="text-2xl font-bold text-green-700">{deleteSummary.interestedCount}</p>
                    </div>
                  )}
                  {deleteSummary.followupsCount > 0 && (
                    <div className="bg-orange-50 rounded-lg p-3">
                      <p className="text-xs text-orange-600 font-medium">Follow-ups</p>
                      <p className="text-2xl font-bold text-orange-700">{deleteSummary.followupsCount}</p>
                    </div>
                  )}
                </div>

                {/* Recipients */}
                {deleteSummary.remainingActiveAdmins.length > 0 ? (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">Will be redistributed equally to:</p>
                    <div className="space-y-1">
                      {deleteSummary.remainingActiveAdmins.map((admin) => (
                        <div key={admin.userId} className="flex items-center gap-2 text-sm">
                          <User className="h-3.5 w-3.5 text-gray-400" />
                          <span className="font-medium">{admin.name}</span>
                          <span className="text-gray-400 text-xs">({admin.email})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700 font-medium">
                      ⚠ No active users in the target pool to transfer assignments to. Deletion is blocked.
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={closeDeleteDialog}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleTransferAndProceed}
                  disabled={deleteSummary.remainingActiveAdmins.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Transfer & Delete Account
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Step: Transferring */}
          {deleteStep === 'transferring' && (
            <>
              <DialogHeader>
                <DialogTitle>Transferring &amp; deleting…</DialogTitle>
                <DialogDescription>
                  Redistributing all leads and deleting the account. Please wait.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            </>
          )}

          {/* Step: No assignments – simple confirm */}
          {deleteStep === 'no_transfer' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-700">
                  <Trash2 className="h-5 w-5" />
                  Delete Account
                </DialogTitle>
                <DialogDescription>
                  <strong>{deleteUser?.name || deleteUser?.email}</strong> has no active assignments.
                  Are you sure you want to permanently delete this account?
                </DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
                  ⚠ This action is irreversible. The account and all session data will be permanently removed.
                </p>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={closeDeleteDialog}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleFinalDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Yes, Delete Account
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Step: Deleting */}
          {deleteStep === 'deleting' && (
            <>
              <DialogHeader>
                <DialogTitle>Deleting account…</DialogTitle>
                <DialogDescription>Permanently removing the account. Please wait.</DialogDescription>
              </DialogHeader>
              <div className="flex justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-red-500" />
              </div>
            </>
          )}

          {/* Step: Error – API check failed, stay open and show details */}
          {deleteStep === 'error' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-700">
                  <Trash2 className="h-5 w-5" />
                  Unable to Check Assignments
                </DialogTitle>
                <DialogDescription>
                  Something went wrong while fetching assignment data for{' '}
                  <strong>{deleteUser?.name || deleteUser?.email}</strong>.
                </DialogDescription>
              </DialogHeader>
              <div className="py-2 space-y-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700 font-medium">Error details:</p>
                  <p className="text-sm text-red-600 mt-1">{deleteError}</p>
                </div>
                <p className="text-xs text-gray-500">
                  Please ensure you are logged in with a <strong>lead_access_manager</strong> account and the backend server is running.
                </p>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={closeDeleteDialog}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (deleteUser) {
                      setDeleteStep('checking');
                      setDeleteError(null);
                      userManagementApi.getAssignmentsSummary(deleteUser.userId)
                        .then((res) => {
                          setDeleteSummary(res.data);
                          setDeleteStep(res.data.hasAssignments ? 'transfer_needed' : 'no_transfer');
                        })
                        .catch((err: any) => {
                          setDeleteError(err.message || 'Failed to check assignments. Please try again.');
                          setDeleteStep('error');
                        });
                    }
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
