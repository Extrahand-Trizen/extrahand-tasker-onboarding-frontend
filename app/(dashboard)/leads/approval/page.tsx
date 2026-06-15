'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { caosApi, type Lead } from '@/lib/api/caos';
import { useSessionStorage } from '@/lib/hooks/useSessionStorage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CheckCircle, XCircle, AlertCircle, CheckSquare, Square, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';
import { leadStatusLabel, primaryCategoryLabel } from '@/lib/leadLabels';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const statusColors: Record<Lead['status'], string> = {
  lead_added: 'bg-gray-100 text-gray-800',
  contacted_not_lifted: 'bg-slate-100 text-slate-800',
  contacted_not_interested: 'bg-blue-100 text-blue-800',
  contacted_interested: 'bg-yellow-100 text-yellow-800',
  documents_submitted: 'bg-purple-100 text-purple-800',
  under_verification: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-500',
};

export default function ApprovalQueuePage() {
  const queryClient = useQueryClient();
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [searchCity, setSearchCity] = useSessionStorage('approval-searchCity', '');
  const [searchSkill, setSearchSkill] = useSessionStorage('approval-searchSkill', '');
  const [page, setPage] = useSessionStorage('approval-page', 1);
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['approval-queue', page, searchCity, searchSkill],
    queryFn: () => caosApi.getApprovalQueue({ city: searchCity, primarySkill: searchSkill, page, limit: 20 }),
  });

  const approveMutation = useMutation({
    mutationFn: ({ leadId, notes }: { leadId: string; notes?: string }) =>
      caosApi.approveLead(leadId, notes),
    onSuccess: () => {
      toast.success('Helper approved successfully');
      queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve helper');
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: ({ leadIds, notes }: { leadIds: string[]; notes?: string }) =>
      caosApi.bulkApproveLeads(leadIds, notes),
    onSuccess: (data) => {
      toast.success(`Approved ${data.data.success} of ${data.data.total} helpers`);
      setSelectedLeads(new Set());
      setShowBulkApproveModal(false);
      setApprovalNotes('');
      queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to bulk approve helpers');
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
    if (selectedLeads.size === data?.data.leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(data?.data.leads.map(l => l.leadId) || []));
    }
  };

  const handleBulkApprove = () => {
    if (selectedLeads.size === 0) {
      toast.error('Please select at least one helper');
      return;
    }
    bulkApproveMutation.mutate({
      leadIds: Array.from(selectedLeads),
      notes: approvalNotes || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const leads = data?.data.leads || [];
  const total = data?.data.total || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Approve Helpers</h1>
          <p className="text-sm text-gray-600 mt-1">
            Helpers that are ready to be approved ({total} total)
          </p>
        </div>
        {selectedLeads.size > 0 && (
          <Button
            onClick={() => setShowBulkApproveModal(true)}
            disabled={bulkApproveMutation.isPending}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Approve Selected ({selectedLeads.size})
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="city-filter">City</Label>
              <Input
                id="city-filter"
                value={searchCity}
                onChange={(e) => {
                  setSearchCity(e.target.value);
                  setPage(1);
                }}
                placeholder="Filter by city..."
              />
            </div>
            <div>
              <Label htmlFor="skill-filter">Primary Skill</Label>
              <Input
                id="skill-filter"
                value={searchSkill}
                onChange={(e) => {
                  setSearchSkill(e.target.value);
                  setPage(1);
                }}
                placeholder="Filter by skill..."
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchCity('');
                  setSearchSkill('');
                  setPage(1);
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Taskers List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Leads Pending Approval</CardTitle>
            {leads.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedLeads.size === leads.length && leads.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <Label className="text-sm">Select All</Label>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No helpers in approval queue</p>
            </div>
          ) : (
            <div className="space-y-4">
              {leads.map((lead: Lead & { approvalCriteria?: any }) => {
                const criteria = lead.approvalCriteria;
                const isSelected = selectedLeads.has(lead.leadId);
                const canApprove = criteria?.canApprove !== false;
                const readinessReasons = criteria?.reasons || criteria?.missingRequirements || [];

                return (
                  <div
                    key={lead.leadId}
                    className={`border rounded-lg p-4 ${isSelected ? 'bg-blue-50 border-blue-300' : ''}`}
                  >
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(lead.leadId)}
                        disabled={!canApprove}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <Link
                              href={`/leads/${lead.leadId}`}
                              className="font-semibold text-lg hover:underline"
                            >
                              {lead.name}
                            </Link>
                            <Badge className={statusColors[lead.status]}>
                              {leadStatusLabel(lead.status)}
                            </Badge>
                            {canApprove ? (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Ready
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800">
                                <XCircle className="h-3 w-3 mr-1" />
                                Not Ready
                              </Badge>
                            )}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => approveMutation.mutate({ leadId: lead.leadId })}
                            disabled={!canApprove || approveMutation.isPending}
                          >
                            {approveMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Approve
                              </>
                            )}
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                          <div>
                            <span className="text-gray-600">Phone:</span> {lead.phone}
                          </div>
                          <div>
                            <span className="text-gray-600">City:</span> {lead.city}
                          </div>
                          <div>
                            <span className="text-gray-600">Skill:</span> {primaryCategoryLabel(lead.primaryCategory || (lead as any).primarySkill)}
                          </div>
                          <div>
                            <span className="text-gray-600">Helper ID:</span> {lead.leadId}
                          </div>
                        </div>

                        {criteria && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertCircle className="h-4 w-4 text-gray-600" />
                              <span className="text-sm font-medium">Approval Criteria</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                              <div className="flex items-center gap-1">
                                {criteria.hasRequiredDocuments ? (
                                  <CheckCircle className="h-3 w-3 text-green-600" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-red-600" />
                                )}
                                <span>Required Documents</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {criteria.hasVerifiedDocuments ? (
                                  <CheckCircle className="h-3 w-3 text-green-600" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-red-600" />
                                )}
                                <span>Verified Documents</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {criteria.hasSkills ? (
                                  <CheckCircle className="h-3 w-3 text-green-600" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-red-600" />
                                )}
                                <span>Skills Assigned</span>
                              </div>
                            </div>
                            {readinessReasons && readinessReasons.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {readinessReasons.map((reason: string, idx: number) => (
                                  <Badge
                                    key={idx}
                                    variant="secondary"
                                    className="bg-gray-100 text-gray-700"
                                  >
                                    {reason}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {total > 20 && (
            <div className="flex items-center justify-between mt-6">
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(total / 20)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showBulkApproveModal} onOpenChange={setShowBulkApproveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve selected helpers</DialogTitle>
            <DialogDescription>
              {selectedLeads.size} helper{selectedLeads.size === 1 ? '' : 's'} will be approved. Add an optional note for the activity log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="approval-notes">Notes (optional)</Label>
            <Textarea
              id="approval-notes"
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="Add notes about this approval..."
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowBulkApproveModal(false);
                setApprovalNotes('');
              }}
              disabled={bulkApproveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkApprove}
              disabled={bulkApproveMutation.isPending}
            >
              {bulkApproveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve {selectedLeads.size} helper{selectedLeads.size === 1 ? '' : 's'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



