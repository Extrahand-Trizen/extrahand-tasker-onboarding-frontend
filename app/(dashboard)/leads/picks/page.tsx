'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSessionStorage } from '@/lib/hooks/useSessionStorage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { caosApi, type LeadStatus } from '@/lib/api/caos';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, ArrowRightLeft, Eye, Clock, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { leadStatusLabel } from '@/lib/leadLabels';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const statusColors: Record<LeadStatus, string> = {
  lead_added: 'bg-gray-100 text-gray-800',
  contacted_not_lifted: 'bg-slate-100 text-slate-800',
  contacted_not_interested: 'bg-blue-100 text-blue-800',
  contacted_interested: 'bg-yellow-100 text-yellow-800',
  documents_submitted: 'bg-purple-100 text-purple-800',
  under_verification: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-500',
};

export default function MyPicksPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { role, user, loading: authLoading } = useJWTAuth();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('lastLeadsPath', '/leads/picks');
    }
  }, []);

  const [search, setSearch] = useSessionStorage('picks-search', '');
  const [statusFilter, setStatusFilter] = useSessionStorage<LeadStatus | 'all'>('picks-statusFilter', 'all');
  const [page, setPage] = useSessionStorage('picks-page', 1);
  const [limit, setLimit] = useSessionStorage('picks-limit', 20);
  const [transferLeadId, setTransferLeadId] = useState<string | null>(null);
  const [targetQualifier, setTargetQualifier] = useState<string>('');

  const currentUserId =
    user && typeof user === 'object'
      ? ('userId' in user && typeof user.userId === 'string'
          ? user.userId
          : 'uid' in user && typeof user.uid === 'string'
            ? user.uid
            : undefined)
      : undefined;
  const currentUserIdentities = Array.from(new Set([
    currentUserId,
    user && typeof user === 'object' && 'email' in user && typeof user.email === 'string' ? user.email : undefined,
  ].filter((identity): identity is string => !!identity)));

  if (!authLoading && role !== 'onboarder' && role !== 'lead_access_manager') {
    router.replace('/dashboard');
  }

  const onboardersQuery = useQuery({
    queryKey: ['onboarders'],
    queryFn: () => caosApi.getOnboarders(),
    enabled: mounted && !authLoading && (role === 'onboarder' || role === 'lead_access_manager'),
  });

  const onboarders = useMemo(
    () => (onboardersQuery.data?.data || []).filter((o) => o.userId && o.userId !== currentUserId),
    [onboardersQuery.data, currentUserId]
  );

  const { data, isLoading } = useQuery({
    queryKey: ['my-picks', { search, statusFilter, page, limit, pickedByAny: currentUserIdentities }],
    queryFn: () =>
      caosApi.searchLeads({
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        pickedByAny: currentUserIdentities,
        page,
        limit,
      }),
    enabled: mounted && !authLoading && !!currentUserId && (role === 'onboarder' || role === 'lead_access_manager'),
  });

  const leads = data?.data || [];
  const pagination = data?.pagination;

  const pendingTransfersQuery = useQuery({
    queryKey: ['pending-transfers', { currentUserId }],
    queryFn: () =>
      caosApi.searchLeads({
        transferPendingTo: currentUserId || undefined,
        limit: 100,
      }),
    enabled: mounted && !authLoading && !!currentUserId && (role === 'onboarder' || role === 'lead_access_manager'),
  });

  const pendingTransfers = pendingTransfersQuery.data?.data || [];

  const acceptMutation = useMutation({
    mutationFn: (leadId: string) => caosApi.acceptTransferLead(leadId),
    onSuccess: () => {
      toast.success('Lead transfer accepted successfully');
      queryClient.invalidateQueries({ queryKey: ['my-picks'] });
      queryClient.invalidateQueries({ queryKey: ['pending-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['all-leads'] });
      queryClient.invalidateQueries({ queryKey: ['interested-candidates'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to accept transfer');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (leadId: string) => caosApi.rejectTransferLead(leadId),
    onSuccess: () => {
      toast.success('Lead transfer rejected successfully');
      queryClient.invalidateQueries({ queryKey: ['my-picks'] });
      queryClient.invalidateQueries({ queryKey: ['pending-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['all-leads'] });
      queryClient.invalidateQueries({ queryKey: ['interested-candidates'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject transfer');
    },
  });

  const transferMutation = useMutation({
    mutationFn: ({ leadId, targetUserId }: { leadId: string; targetUserId: string }) =>
      caosApi.transferLead(leadId, targetUserId),
    onSuccess: () => {
      toast.success('Lead transfer requested');
      setTransferLeadId(null);
      setTargetQualifier('');
      queryClient.invalidateQueries({ queryKey: ['my-picks'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['all-leads'] });
      queryClient.invalidateQueries({ queryKey: ['interested-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['not-interested-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['not-lifted-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['follow-up-queue'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to transfer lead');
    },
  });

  if (!mounted || authLoading || (role !== 'onboarder' && role !== 'lead_access_manager')) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Claims</h1>
        <span className="inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-800 text-sm font-semibold px-3 py-1">
          {pagination?.total || 0} {pagination?.total === 1 ? 'lead' : 'leads'}
        </span>
      </div>

      {pendingTransfers.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-amber-900 flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-amber-600 animate-pulse" />
              Incoming Transfer Claims ({pendingTransfers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {pendingTransfers.map((lead) => (
                <div key={lead.leadId} className="bg-white p-4 rounded-lg border border-amber-100 shadow-sm flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-gray-900 text-sm sm:text-base">{lead.name}</h4>
                      <Badge className={statusColors[lead.status] || 'bg-gray-100 text-gray-800'}>{leadStatusLabel(lead.status)}</Badge>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{lead.phone || (lead as any).landline || '-'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{lead.city || '-'}</p>
                    <p className="text-xs text-amber-800 mt-2 bg-amber-50 p-2 rounded">
                      Transferred by: <strong>{(lead as any).lastTransferredByName || lead.pickedByName || 'another user'}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100 mt-1">
                    <Link href={`/leads/${lead.leadId}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                      onClick={() => acceptMutation.mutate(lead.leadId)}
                      disabled={acceptMutation.isPending || rejectMutation.isPending}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-red-200 text-red-700 hover:bg-red-50 text-xs"
                      onClick={() => rejectMutation.mutate(lead.leadId)}
                      disabled={acceptMutation.isPending || rejectMutation.isPending}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-gray-200 shadow-sm">
        <CardContent className="pt-4 sm:pt-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            <div className="relative">
              <Input
                placeholder="Search by name, phone, or city..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="border-gray-300 focus:border-amber-500 focus:ring-amber-500"
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as LeadStatus | 'all');
                setPage(1);
              }}
            >
              <SelectTrigger className="border-gray-300">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="lead_added">New Lead</SelectItem>
                <SelectItem value="contacted_not_lifted">Contacted &amp; Not Lifted</SelectItem>
                <SelectItem value="contacted_not_interested">Contacted &amp; Not Interested</SelectItem>
                <SelectItem value="contacted_interested">Contacted &amp; Interested</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={limit.toString()}
              onValueChange={(value) => {
                setLimit(parseInt(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="border-gray-300">
                <SelectValue placeholder="Items per page" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Claimed Leads</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No claimed leads yet</p>
            </div>
          ) : (
            <>
            <div className="block md:hidden space-y-3">
              {leads.map((lead) => (
                <div key={lead.leadId} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{lead.name}</p>
                      <p className="text-xs text-gray-600 mt-1">{lead.phone || lead.landline || '-'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{lead.city || '-'}</p>
                      <p className="text-xs text-gray-500 mt-1">Claimed: {lead.pickedAt ? format(new Date(lead.pickedAt), 'MMM dd, yyyy, h:mm a') : '-'}</p>
                      {lead.transferPendingTo && (
                        <p className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-100 mt-1.5 inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Pending → {lead.transferPendingToName || 'another user'}
                        </p>
                      )}
                      {!lead.transferPendingTo && lead.transferHistory && lead.transferHistory.length > 0 && (() => {
                        const last = [...lead.transferHistory].reverse().find((h) => h.status !== 'pending');
                        if (!last || last.fromUserId !== currentUserId) return null;
                        if (last.status === 'accepted') return (
                          <p className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded border border-green-100 mt-1.5 inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Accepted by {last.toUserName || 'recipient'}
                          </p>
                        );
                        if (last.status === 'rejected') return (
                          <p className="text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded border border-red-100 mt-1.5 inline-flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            Rejected by {last.toUserName || 'recipient'}
                          </p>
                        );
                        return null;
                      })()}
                    </div>
                    <Badge className={statusColors[lead.status]}>{leadStatusLabel(lead.status)}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Link href={`/leads/${lead.leadId}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTransferLeadId(lead.leadId)}
                    >
                      <ArrowRightLeft className="h-4 w-4 mr-1" />
                      Transfer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Claimed At</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Transferred By</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {leads.map((lead) => (
                    <tr key={lead.leadId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{lead.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {lead.city || '-'}
                        </div>
                        {lead.transferPendingTo && (
                          <div className="mt-1">
                            <Badge className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] py-0 px-1.5 font-normal">
                              <Clock className="inline h-2.5 w-2.5 mr-0.5" />
                              Pending → {lead.transferPendingToName || 'another user'}
                            </Badge>
                          </div>
                        )}
                        {!lead.transferPendingTo && lead.transferHistory && lead.transferHistory.length > 0 && (() => {
                          const last = [...lead.transferHistory].reverse().find((h) => h.status !== 'pending');
                          if (!last || last.fromUserId !== currentUserId) return null;
                          
                          if (last.status === 'accepted') return (
                            <div className="mt-1">
                              <Badge className="bg-green-50 text-green-700 border border-green-200 text-[10px] py-0 px-1.5 font-normal">
                                <CheckCircle2 className="inline h-2.5 w-2.5 mr-0.5" />
                                Accepted by {last.toUserName || 'recipient'}
                              </Badge>
                            </div>
                          );
                          if (last.status === 'rejected') return (
                            <div className="mt-1">
                              <Badge className="bg-red-50 text-red-700 border border-red-200 text-[10px] py-0 px-1.5 font-normal">
                                <XCircle className="inline h-2.5 w-2.5 mr-0.5" />
                                Rejected by {last.toUserName || 'recipient'}
                              </Badge>
                            </div>
                          );
                          return null;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {lead.phone || (lead as any).landline || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={statusColors[lead.status]}>
                          {leadStatusLabel(lead.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {lead.pickedAt ? format(new Date(lead.pickedAt), 'MMM dd, yyyy, h:mm a') : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {lead.lastTransferredByName || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/leads/${lead.leadId}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTransferLeadId(lead.leadId)}
                          >
                            <ArrowRightLeft className="h-4 w-4 mr-1" />
                            Transfer
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {pagination && pagination.totalPages > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 mt-6 pt-4 border-t border-gray-200">
          <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} leads
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => setPage(pagination.page - 1)}
              className="flex-1 sm:flex-none"
            >
              Previous
            </Button>
            <span className="text-xs sm:text-sm text-gray-600 px-2">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => setPage(pagination.page + 1)}
              className="flex-1 sm:flex-none"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!transferLeadId} onOpenChange={(open) => !open && setTransferLeadId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Lead</DialogTitle>
            <DialogDescription>
              Select a qualifier or onboarder to transfer this lead. You can transfer the same lead multiple times — the latest pending request replaces any previous one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="transfer-qualifier">Recipient</Label>
            <Select
              value={targetQualifier}
              onValueChange={(value) => setTargetQualifier(value)}
            >
              <SelectTrigger id="transfer-qualifier">
                <SelectValue placeholder="Select recipient" />
              </SelectTrigger>
              <SelectContent>
                {onboarders.map((onboarder) => (
                  <SelectItem key={onboarder.userId} value={onboarder.userId}>
                    {onboarder.name && onboarder.name.trim() ? onboarder.name : (onboarder.email || onboarder.userId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setTransferLeadId(null);
                setTargetQualifier('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!transferLeadId || !targetQualifier) {
                  toast.error('Select a recipient to transfer');
                  return;
                }
                transferMutation.mutate({ leadId: transferLeadId, targetUserId: targetQualifier });
              }}
              disabled={transferMutation.isPending}
            >
              {transferMutation.isPending ? 'Transferring...' : 'Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
