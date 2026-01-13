'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { caosApi, type Lead } from '@/lib/api/caos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CheckCircle, Loader2, Zap, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';
import { leadStatusLabel } from '@/lib/leadLabels';
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
  contacted: 'bg-blue-100 text-blue-800',
  interested: 'bg-yellow-100 text-yellow-800',
  documents_submitted: 'bg-purple-100 text-purple-800',
  under_verification: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  inactive: 'bg-gray-100 text-gray-500',
};

export default function ActivationQueuePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { role, loading: authLoading } = useJWTAuth();
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [searchCity, setSearchCity] = useState('');
  const [searchSkill, setSearchSkill] = useState('');
  const [page, setPage] = useState(1);
  const [showBulkActivateModal, setShowBulkActivateModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);

  // ✅ Role-based access: Only onboarder and admin can access activation queue
  const canAccess = !authLoading && (role === 'onboarder' || role === 'admin');

  const [bulkResult, setBulkResult] = useState<{
    success: { leadId: string; firebaseUid?: string; profileCreated?: boolean }[];
    failed: { leadId: string; reason?: string; error?: string }[];
  }>({
    success: [],
    failed: [],
  });

  useEffect(() => {
    if (!authLoading && !canAccess) {
      toast.error('You do not have permission to access the activation queue. Only onboarder and admin teams can activate leads.');
      router.push('/leads');
    }
  }, [authLoading, canAccess, router]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['activation-queue', page, searchCity, searchSkill],
    queryFn: () => caosApi.getActivationQueue({ city: searchCity, primarySkill: searchSkill, page, limit: 20 }),
  });

  const activateMutation = useMutation({
    mutationFn: (leadId: string) => caosApi.activateLead(leadId),
    onSuccess: () => {
      toast.success('Tasker activated successfully');
      queryClient.invalidateQueries({ queryKey: ['activation-queue'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to activate tasker');
    },
  });

  const bulkActivateMutation = useMutation({
    mutationFn: (leadIds: string[]) => caosApi.bulkActivateLeads(leadIds),
    onSuccess: (data) => {
      const successArr = data.data.success || [];
      const failedArr = (data.data.failed || []).map((f: any) => ({
        leadId: f.leadId,
        reason: f.reason || f.error,
      }));
      toast.success(`Activated ${successArr.length} of ${successArr.length + failedArr.length} taskers`);
      setBulkResult({ success: successArr, failed: failedArr });
      setShowResultModal(true);
      setSelectedLeads(new Set());
      setShowBulkActivateModal(false);
      queryClient.invalidateQueries({ queryKey: ['activation-queue'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to bulk activate taskers');
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

  const handleBulkActivate = () => {
    if (selectedLeads.size === 0) {
      toast.error('Please select at least one tasker');
      return;
    }
    bulkActivateMutation.mutate(Array.from(selectedLeads));
  };

  const handleRetryFailed = () => {
    if (bulkResult.failed.length === 0) return;
    const failedIds = bulkResult.failed.map((f) => f.leadId);
    setSelectedLeads(new Set(failedIds));
    setShowResultModal(false);
    setShowBulkActivateModal(true);
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Show unauthorized message if user doesn't have access
  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <ShieldAlert className="h-16 w-16 text-red-500" />
        <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
        <p className="text-gray-600">You do not have permission to access the activation queue.</p>
        <p className="text-sm text-gray-500">Only onboarder and admin teams can activate leads.</p>
        <Link href="/leads">
          <Button variant="outline">Go to Partner List</Button>
        </Link>
      </div>
    );
  }

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
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Ready for Activation</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-1.5">
            {total} approved taskers ready to create accounts
          </p>
        </div>
        {selectedLeads.size > 0 && (
          <Button
            onClick={() => setShowBulkActivateModal(true)}
            disabled={bulkActivateMutation.isPending}
            className="w-full sm:w-auto"
          >
            <Zap className="h-4 w-4 mr-2" />
            Create Accounts ({selectedLeads.size})
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="pt-4 sm:pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <Label htmlFor="city-filter" className="text-sm font-medium text-gray-700">City</Label>
              <Input
                id="city-filter"
                value={searchCity}
                onChange={(e) => {
                  setSearchCity(e.target.value);
                  setPage(1);
                }}
                placeholder="Filter by city..."
                className="mt-1.5 border-gray-300 focus:border-amber-500 focus:ring-amber-500"
              />
            </div>
            <div>
              <Label htmlFor="skill-filter" className="text-sm font-medium text-gray-700">Primary Skill</Label>
              <Input
                id="skill-filter"
                value={searchSkill}
                onChange={(e) => {
                  setSearchSkill(e.target.value);
                  setPage(1);
                }}
                placeholder="Filter by skill..."
                className="mt-1.5 border-gray-300 focus:border-amber-500 focus:ring-amber-500"
              />
            </div>
            <div className="flex items-end sm:col-span-2 md:col-span-1">
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
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-900">Taskers Ready for Activation</CardTitle>
            {leads.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedLeads.size === leads.length && leads.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <Label className="text-sm text-gray-600">Select All</Label>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No taskers in activation queue</p>
            </div>
          ) : (
            <div className="space-y-4">
              {leads.map((lead: Lead) => {
                const isSelected = selectedLeads.has(lead.leadId);

                return (
                  <div
                    key={lead.leadId}
                    className={`border rounded-lg p-3 sm:p-4 transition-colors ${isSelected ? 'bg-amber-50 border-amber-300 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(lead.leadId)}
                        className="mt-1"
                      />
                      <div className="flex-1 w-full">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-2">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <Link
                              href={`/leads/${lead.leadId}`}
                              className="font-semibold text-base sm:text-lg hover:underline"
                            >
                              {lead.name}
                            </Link>
                            <Badge className={statusColors[lead.status]}>
                              {leadStatusLabel(lead.status)}
                            </Badge>
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approved
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => activateMutation.mutate(lead.leadId)}
                            disabled={activateMutation.isPending}
                          >
                            {activateMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Zap className="h-4 w-4 mr-2" />
                                Create
                              </>
                            )}
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm">
                          <div>
                            <span className="text-gray-600">Phone:</span> {lead.phone}
                          </div>
                          <div>
                            <span className="text-gray-600">City:</span> {lead.city}
                          </div>
                          <div>
                            <span className="text-gray-600">Category:</span> {lead.primaryCategory}
                          </div>
                          <div>
                            <span className="text-gray-600">Tasker ID:</span> {lead.leadId}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {total > 20 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 mt-6">
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Previous
              </Button>
              <span className="text-xs sm:text-sm text-gray-600 order-1 sm:order-2">
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(total / 20)}
                className="w-full sm:w-auto order-3"
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showBulkActivateModal} onOpenChange={setShowBulkActivateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create accounts for selected taskers</DialogTitle>
            <DialogDescription>
              This will create Firebase accounts and user profiles for {selectedLeads.size}{' '}
              tasker{selectedLeads.size === 1 ? '' : 's'}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-gray-700">
            <p>Selected: {selectedLeads.size}</p>
            <p className="text-gray-600">
              Activation may return partial failures (e.g., if a profile already exists). You can retry failed
              items individually or re-run bulk after reviewing the errors.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowBulkActivateModal(false)}
              disabled={bulkActivateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkActivate}
              disabled={bulkActivateMutation.isPending}
            >
              {bulkActivateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Create {selectedLeads.size} account{selectedLeads.size === 1 ? '' : 's'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activation results</DialogTitle>
            <DialogDescription>
              {bulkResult.success.length} succeeded, {bulkResult.failed.length} failed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {bulkResult.success.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-green-700 mb-2">Succeeded</h4>
                <div className="space-y-1 text-sm text-gray-700">
                  {bulkResult.success.map((item) => (
                    <div key={item.leadId} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>
                        {item.leadId}
                        {item.firebaseUid ? ` • uid: ${item.firebaseUid}` : ''}
                        {item.profileCreated === false ? ' • profile not created' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {bulkResult.failed.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-700 mb-2">Failed</h4>
                <div className="space-y-2 text-sm text-gray-700">
                  {bulkResult.failed.map((f) => (
                    <div key={f.leadId} className="rounded-md border border-red-200 bg-red-50 p-2">
                      <div className="flex items-center gap-2 font-medium text-red-800">
                        <Zap className="h-4 w-4" />
                        <span>{f.leadId}</span>
                      </div>
                      {f.reason && <p className="text-xs text-red-700 mt-1">{f.reason}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            {bulkResult.failed.length > 0 && (
              <Button onClick={handleRetryFailed} disabled={bulkActivateMutation.isPending}>
                Retry failed ({bulkResult.failed.length})
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowResultModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


