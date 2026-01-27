'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { caosApi, type LeadStatus, type LeadSource, type Lead } from '@/lib/api/caos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Trash2 } from 'lucide-react';
import { leadStatusLabel } from '@/lib/leadLabels';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { toast } from 'sonner';

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

export default function AllLeadsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { role, loading: authLoading } = useJWTAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [addedByFilter, setAddedByFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // Redirect if not lead_access_manager
  if (!authLoading && role !== 'lead_access_manager') {
    router.replace('/leads');
    return null;
  }

  // Fetch lead creators for the filter dropdown
  const { data: creatorsData } = useQuery({
    queryKey: ['lead-creators'],
    queryFn: () => caosApi.getLeadCreators(),
    enabled: !authLoading && role === 'lead_access_manager',
  });

  const leadCreators = creatorsData?.data || [];

  const { data, isLoading, error } = useQuery({
    queryKey: ['all-leads', { search, statusFilter, addedByFilter, page }],
    queryFn: () =>
      caosApi.searchLeads({
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        addedBy: addedByFilter !== 'all' ? addedByFilter : undefined,
        page,
        limit,
      }),
    enabled: !authLoading && role === 'lead_access_manager',
  });

  const leads = data?.data || [];
  const pagination = data?.pagination;

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: (leadIds: string[]) => caosApi.bulkDeleteLeads(leadIds),
    onSuccess: (response) => {
      const { deletedCount, failedCount } = response.data;
      if (failedCount === 0) {
        toast.success(`Successfully deleted ${deletedCount} lead(s)`);
      } else {
        toast.warning(`Deleted ${deletedCount} lead(s), ${failedCount} failed`);
      }
      setSelectedLeadIds(new Set());
      setShowBulkDeleteModal(false);
      queryClient.invalidateQueries({ queryKey: ['all-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete leads');
    },
  });

  // Handle individual checkbox toggle
  const handleToggleLead = (leadId: string) => {
    const newSelected = new Set(selectedLeadIds);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeadIds(newSelected);
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeadIds(new Set(leads.map(lead => lead.leadId)));
    } else {
      setSelectedLeadIds(new Set());
    }
  };

  const isAllSelected = leads.length > 0 && selectedLeadIds.size === leads.length;
  const isSomeSelected = selectedLeadIds.size > 0 && selectedLeadIds.size < leads.length;

  if (authLoading) {
    return (
      <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-amber-500 border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (role !== 'lead_access_manager') {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">All Leads</h1>
          <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm text-gray-500">
            View all leads from all qualifiers and onboarders
          </p>
        </div>
        {selectedLeadIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {selectedLeadIds.size} selected
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteModal(true)}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
          </div>
        )}
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
                <SelectItem value="documents_submitted">Documents Submitted</SelectItem>
                <SelectItem value="under_verification">Under Verification</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={addedByFilter}
              onValueChange={(value) => {
                setAddedByFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="border-gray-300">
                <SelectValue placeholder="All Uploaders" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Uploaders</SelectItem>
                {leadCreators.map((creator) => (
                  <SelectItem key={creator.userId} value={creator.userId}>
                    {creator.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table/Cards */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="pt-4 sm:pt-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-amber-500 border-r-transparent"></div>
              <p className="mt-4 text-sm text-gray-600">Loading leads...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 font-medium">Error loading leads</p>
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
          ) : leads.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No leads found</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block sm:hidden space-y-3">
                {leads.map((lead) => (
                  <div
                    key={lead.leadId}
                    className={cn(
                      "border border-gray-200 rounded-lg p-4 transition-colors",
                      selectedLeadIds.has(lead.leadId) ? "bg-amber-50" : "hover:bg-amber-50/50"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-2 flex-1">
                        <Checkbox
                          checked={selectedLeadIds.has(lead.leadId)}
                          onCheckedChange={() => handleToggleLead(lead.leadId)}
                          className="mt-1 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1" onClick={() => router.push(`/leads/${lead.leadId}`)}>
                          <h3 className="font-medium text-gray-900 text-sm">{lead.name}</h3>
                          <p className="text-xs text-gray-600 mt-1">{lead.phone}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{lead.city}</p>
                          {lead.addedByName && (
                            <p className="text-xs text-amber-600 mt-1 font-medium">
                              Added by: {lead.addedByName}
                            </p>
                          )}
                          {lead.createdAt && (
                            <p className="text-xs text-gray-400 mt-1">
                              Created: {format(new Date(lead.createdAt), 'MMM dd, yyyy')}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/leads/${lead.leadId}`);
                        }}
                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 ml-2"
                      >
                        View
                      </Button>
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
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-12">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={handleSelectAll}
                          className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">City</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Added By</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {leads.map((lead) => (
                      <tr
                        key={lead.leadId}
                        className={cn(
                          "hover:bg-amber-50/50 transition-colors",
                          selectedLeadIds.has(lead.leadId) && "bg-amber-50"
                        )}
                      >
                        <td 
                          className="px-4 py-3"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleLead(lead.leadId);
                          }}
                        >
                          <Checkbox
                            checked={selectedLeadIds.has(lead.leadId)}
                            onCheckedChange={() => handleToggleLead(lead.leadId)}
                            className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td 
                          className="px-4 py-3 text-sm font-medium text-gray-900 cursor-pointer"
                          onClick={() => router.push(`/leads/${lead.leadId}`)}
                        >
                          {lead.name}
                        </td>
                        <td 
                          className="px-4 py-3 text-sm text-gray-600 cursor-pointer"
                          onClick={() => router.push(`/leads/${lead.leadId}`)}
                        >
                          {lead.phone}
                        </td>
                        <td 
                          className="px-4 py-3 text-sm text-gray-600 cursor-pointer"
                          onClick={() => router.push(`/leads/${lead.leadId}`)}
                        >
                          {lead.city}
                        </td>
                        <td 
                          className="px-4 py-3 text-sm text-gray-600 cursor-pointer"
                          onClick={() => router.push(`/leads/${lead.leadId}`)}
                        >
                          {lead.addedByName || 'Unknown'}
                        </td>
                        <td 
                          className="px-4 py-3 cursor-pointer"
                          onClick={() => router.push(`/leads/${lead.leadId}`)}
                        >
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
                        <td 
                          className="px-4 py-3 text-sm text-gray-600 cursor-pointer"
                          onClick={() => router.push(`/leads/${lead.leadId}`)}
                        >
                          {lead.createdAt ? format(new Date(lead.createdAt), 'MMM dd, yyyy') : '-'}
                        </td>
                        <td className="px-4 py-3">
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
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

      {/* Bulk Delete Confirmation Modal */}
      <Dialog open={showBulkDeleteModal} onOpenChange={setShowBulkDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Selected Leads</DialogTitle>
            <DialogDescription>
              This action cannot be undone. {selectedLeadIds.size} lead(s) will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-medium text-red-900 mb-2">Warning:</p>
              <p className="text-sm text-red-800">
                You are about to delete {selectedLeadIds.size} lead(s). This action cannot be undone and all associated data will be permanently removed.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkDeleteModal(false)}
              disabled={bulkDeleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                bulkDeleteMutation.mutate(Array.from(selectedLeadIds));
              }}
              disabled={bulkDeleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {bulkDeleteMutation.isPending ? 'Deleting...' : `Delete ${selectedLeadIds.size} Lead(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
