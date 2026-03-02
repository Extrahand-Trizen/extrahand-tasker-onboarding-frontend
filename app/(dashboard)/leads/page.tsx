'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { caosApi, type LeadStatus, type LeadSource } from '@/lib/api/caos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { leadStatusLabel } from '@/lib/leadLabels';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { toast } from 'sonner';
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
  contacted: 'bg-blue-100 text-blue-800',
  interested: 'bg-yellow-100 text-yellow-800',
  documents_submitted: 'bg-purple-100 text-purple-800',
  under_verification: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  inactive: 'bg-gray-100 text-gray-500',
};

export default function LeadsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, loading: authLoading, role } = useJWTAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Get current user's ID (handles both JWT userId and Firebase uid)
  const currentUserId = user?.userId || (user as any)?.uid;

  const { data, isLoading, error } = useQuery({
    queryKey: ['leads', { search, statusFilter, page, limit, userId: currentUserId }],
    queryFn: () =>
      caosApi.searchLeads({
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        // ✅ Filter by current user's leads (for everyone, including lead_access_manager)
        // This shows "My Leads" - leads added by the current user
        addedBy: currentUserId || undefined,
        page,
        limit,
      }),
    enabled: !authLoading && !!currentUserId,
  });

  const leads = data?.data || [];
  const pagination = data?.pagination;

  // Delete mutations
  const deleteMutation = useMutation({
    mutationFn: (leadId: string) => caosApi.deleteLead(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead deleted successfully');
      setSelectedLeads(new Set());
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete lead');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (leadIds: string[]) => caosApi.bulkDeleteLeads(leadIds),
    onSuccess: (data) => {
      toast.success(`Deleted ${data.data.success} of ${data.data.success + data.data.failed} leads`);
      setSelectedLeads(new Set());
      setShowDeleteDialog(false);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete leads');
    },
  });

  const toggleSelect = (leadId: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeads(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map(l => l.leadId)));
    }
  };

  const handleDelete = () => {
    if (selectedLeads.size === 0) {
      toast.error('Please select at least one lead');
      return;
    }
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedLeads));
  };

  // Only lead_access_manager can delete leads; onboarder can view All Leads but not delete
  const canDelete = role === 'lead_access_manager';

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Leads List</h1>
          <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm text-gray-500">
            Search and manage all your leads
          </p>
        </div>
        <Link href="/leads/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Lead
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="pt-4 sm:pt-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            <div className="relative sm:col-span-2 md:col-span-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by name, phone, or city..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10 border-gray-300 focus:border-amber-500 focus:ring-amber-500"
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
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="interested">Interested</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                {/* ❌ REMOVED: account_created, activated - these are account statuses, not lead statuses */}
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

      {/* Taskers Table/Cards */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="pt-4 sm:pt-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-amber-500 border-r-transparent"></div>
              <p className="mt-4 text-sm text-gray-600">Loading taskers...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 font-medium">Error loading taskers</p>
              <p className="text-sm text-gray-600 mt-2">
                {error instanceof Error ? error.message : 'Failed to fetch leads'}
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </div>
          ) : authLoading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-amber-500 border-r-transparent"></div>
              <p className="mt-4 text-sm text-gray-600">Loading...</p>
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No taskers found</p>
              <Link href="/leads/new">
                <Button variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Tasker
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block sm:hidden space-y-3">
                {leads.map((lead) => {
                  const isSelected = selectedLeads.has(lead.leadId);
                  return (
                    <div
                      key={lead.leadId}
                      className={cn(
                        "border rounded-lg p-4 transition-colors",
                        isSelected ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:bg-amber-50/50 cursor-pointer"
                      )}
                      onClick={() => !canDelete && router.push(`/leads/${lead.leadId}`)}
                    >
                      <div className="flex items-start gap-3 mb-2">
                        {canDelete && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(lead.leadId)}
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 
                            className="font-medium text-gray-900 text-sm cursor-pointer"
                            onClick={() => router.push(`/leads/${lead.leadId}`)}
                          >
                            {lead.name}
                          </h3>
                        <p className="text-xs text-gray-600 mt-1">{lead.phone}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{lead.city}</p>
                        {lead.createdAt && (
                          <p className="text-xs text-gray-400 mt-1">
                            Created: {format(new Date(lead.createdAt), 'MMM dd, yyyy')}
                          </p>
                        )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/leads/${lead.leadId}`);
                            }}
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          >
                            View
                          </Button>
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Are you sure you want to delete this lead?')) {
                                  deleteMutation.mutate(lead.leadId);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <Badge className={cn(statusColors[lead.status], "text-xs font-medium")}>
                          {leadStatusLabel(lead.status)}
                        </Badge>
                        {lead.creationMethod === 'bulk_upload' && (
                          <Badge className="text-xs bg-blue-50 text-blue-700 border border-blue-200">
                            Bulk Upload
                          </Badge>
                        )}
                        {lead.creationMethod === 'manual_onboarding' && (
                          <Badge className="text-xs bg-gray-50 text-gray-700 border border-gray-200">
                            Manual
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {canDelete && (
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-12">
                          <Checkbox
                            checked={leads.length > 0 && selectedLeads.size === leads.length}
                            onCheckedChange={toggleSelectAll}
                          />
                        </th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">City</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {leads.map((lead) => {
                      const isSelected = selectedLeads.has(lead.leadId);
                      return (
                        <tr
                          key={lead.leadId}
                          className={cn(
                            "hover:bg-amber-50/50 transition-colors",
                            isSelected && "bg-blue-50",
                            canDelete ? "" : "cursor-pointer"
                          )}
                          onClick={() => !canDelete && router.push(`/leads/${lead.leadId}`)}
                        >
                          {canDelete && (
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelect(lead.leadId)}
                              />
                            </td>
                          )}
                          <td 
                            className="px-4 py-3 text-sm font-medium text-gray-900 cursor-pointer"
                            onClick={() => router.push(`/leads/${lead.leadId}`)}
                          >
                            {lead.name}
                          </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{lead.phone}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{lead.city}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Badge className={cn(statusColors[lead.status], "text-xs font-medium")}>
                              {leadStatusLabel(lead.status)}
                            </Badge>
                            {lead.creationMethod === 'bulk_upload' && (
                              <Badge className="text-xs bg-blue-50 text-blue-700 border border-blue-200">
                                Bulk Upload
                              </Badge>
                            )}
                            {lead.creationMethod === 'manual_onboarding' && (
                              <Badge className="text-xs bg-gray-50 text-gray-700 border border-gray-200">
                                Manual
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {lead.createdAt ? format(new Date(lead.createdAt), 'MMM dd, yyyy') : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/leads/${lead.leadId}`);
                              }}
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            >
                              View
                            </Button>
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Are you sure you want to delete this lead?')) {
                                    deleteMutation.mutate(lead.leadId);
                                  }
                                }}
                                disabled={deleteMutation.isPending}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Selected Leads</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedLeads.size} lead(s)? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={bulkDeleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

