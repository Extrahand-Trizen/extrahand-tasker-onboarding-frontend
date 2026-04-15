'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import {
  certificateReviewApi,
  type CertificateQueueResponse,
  type CertificateStatus,
} from '@/lib/api/certificateReview';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Search, CheckCircle2, XCircle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

type ActionTarget = {
  uid: string;
  skillIndex: number;
  certificateIndex: number;
  title?: string;
  name?: string;
};

type PreviewDocument = {
  url: string;
  title?: string;
};

const statusColors: Record<CertificateStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  verified: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const REVIEWED_STATUSES: CertificateStatus[] = ['verified', 'rejected'];
const SEARCH_DEBOUNCE_MS = 400;

function formatDateTime(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getItemKey(item: { uid: string; skillIndex: number; certificateIndex: number }): string {
  return `${item.uid}-${item.skillIndex}-${item.certificateIndex}`;
}

function isPdfUrl(url: string): boolean {
  const normalized = url.toLowerCase().split('?')[0];
  return normalized.endsWith('.pdf');
}

function isImageUrl(url: string): boolean {
  const normalized = url.toLowerCase().split('?')[0];
  return (
    normalized.endsWith('.png') ||
    normalized.endsWith('.jpg') ||
    normalized.endsWith('.jpeg') ||
    normalized.endsWith('.gif') ||
    normalized.endsWith('.webp') ||
    normalized.endsWith('.bmp') ||
    normalized.endsWith('.svg')
  );
}

export default function CertificateVerificationPage() {
  const queryClient = useQueryClient();
  const { role, loading: authLoading } = useJWTAuth();

  const canReviewCertificates = role === 'onboarder' || role === 'lead_access_manager' || role === 'support';

  const [q, setQ] = useState('');
  const [uid, setUid] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [debouncedUid, setDebouncedUid] = useState('');
  const [status, setStatus] = useState<CertificateStatus | 'all'>('pending');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [expandedReviewItemKey, setExpandedReviewItemKey] = useState<string | null>(null);

  const [verifyTarget, setVerifyTarget] = useState<ActionTarget | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ActionTarget | null>(null);
  const [previewDocument, setPreviewDocument] = useState<PreviewDocument | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedUid(uid), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [uid]);

  const query = useQuery({
    queryKey: ['certificate-review-queue', { q: debouncedQ, uid: debouncedUid, status, page, limit }],
    enabled: !authLoading && canReviewCertificates,
    queryFn: () =>
      certificateReviewApi.getQueue({
        q: debouncedQ.trim() || undefined,
        uid: debouncedUid.trim() || undefined,
        status: status === 'all' ? undefined : status,
        page,
        limit,
      }),
  });

  const updateQueueItemOptimistically = (
    target: ActionTarget,
    nextStatus: CertificateStatus,
    patch: { reviewNotes?: string; rejectionReason?: string }
  ) => {
    queryClient.setQueriesData<CertificateQueueResponse>(
      { queryKey: ['certificate-review-queue'] },
      (existing) => {
        if (!existing?.data?.items) return existing;
        const nowIso = new Date().toISOString();
        return {
          ...existing,
          data: {
            ...existing.data,
            items: existing.data.items.map((item) => {
              if (
                item.uid === target.uid &&
                item.skillIndex === target.skillIndex &&
                item.certificateIndex === target.certificateIndex
              ) {
                return {
                  ...item,
                  certificate: {
                    ...item.certificate,
                    status: nextStatus,
                    reviewedAt: nowIso,
                    reviewedBy: 'You',
                    reviewNotes: patch.reviewNotes ?? item.certificate.reviewNotes,
                    rejectionReason: patch.rejectionReason,
                  },
                };
              }
              return item;
            }),
          },
        };
      }
    );
  };

  const verifyMutation = useMutation({
    mutationFn: (target: ActionTarget) =>
      certificateReviewApi.verifyCertificate({
        uid: target.uid,
        skillIndex: target.skillIndex,
        certificateIndex: target.certificateIndex,
        reviewNotes: reviewNotes.trim() || undefined,
      }),
    onMutate: async (target) => {
      await queryClient.cancelQueries({ queryKey: ['certificate-review-queue'] });
      const previousQueue = queryClient.getQueriesData<CertificateQueueResponse>({
        queryKey: ['certificate-review-queue'],
      });
      updateQueueItemOptimistically(target, 'verified', {
        reviewNotes: reviewNotes.trim() || undefined,
      });
      return { previousQueue };
    },
    onSuccess: () => {
      toast.success('Certificate verified successfully');
      setVerifyTarget(null);
      setReviewNotes('');
      queryClient.invalidateQueries({ queryKey: ['certificate-review-queue'] });
    },
    onError: (error: any, _target, context) => {
      context?.previousQueue?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast.error(error.message || 'Failed to verify certificate');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (target: ActionTarget) =>
      certificateReviewApi.rejectCertificate({
        uid: target.uid,
        skillIndex: target.skillIndex,
        certificateIndex: target.certificateIndex,
        rejectionReason: rejectionReason.trim(),
        reviewNotes: reviewNotes.trim() || undefined,
      }),
    onMutate: async (target) => {
      await queryClient.cancelQueries({ queryKey: ['certificate-review-queue'] });
      const previousQueue = queryClient.getQueriesData<CertificateQueueResponse>({
        queryKey: ['certificate-review-queue'],
      });
      updateQueueItemOptimistically(target, 'rejected', {
        rejectionReason: rejectionReason.trim(),
        reviewNotes: reviewNotes.trim() || undefined,
      });
      return { previousQueue };
    },
    onSuccess: () => {
      toast.success('Certificate rejected successfully');
      setRejectTarget(null);
      setRejectionReason('');
      setReviewNotes('');
      queryClient.invalidateQueries({ queryKey: ['certificate-review-queue'] });
    },
    onError: (error: any, _target, context) => {
      context?.previousQueue?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast.error(error.message || 'Failed to reject certificate');
    },
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-amber-500 border-r-transparent" />
      </div>
    );
  }

  if (!canReviewCertificates) {
    return (
      <div className="space-y-4 px-4 sm:px-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Certificate Verification</h1>
        <p className="text-sm text-gray-500">You do not have access to this section.</p>
      </div>
    );
  }

  const items = query.data?.data?.items || [];
  const pagination = query.data?.data?.pagination;

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Certificate Verification</h1>
        <p className="mt-1 text-xs sm:text-sm text-gray-500">
          Review and manually verify certificates uploaded by ExtraHand users.
        </p>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardContent className="pt-4 sm:pt-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, email, or phone (min 2 chars)"
                className="pl-10 border-gray-300 focus:border-amber-500 focus:ring-amber-500"
              />
            </div>
            <Input
              value={uid}
              onChange={(e) => {
                setUid(e.target.value);
                setPage(1);
              }}
              placeholder="Or lookup by exact UID"
              className="border-gray-300 focus:border-amber-500 focus:ring-amber-500"
            />
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as CertificateStatus | 'all');
                setPage(1);
              }}
            >
              <SelectTrigger className="border-gray-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            By default this shows latest pending certificates. Use UID/search to narrow results.
          </p>
        </CardContent>
      </Card>

      <Card className="border-gray-200 shadow-sm">
        <CardContent className="pt-4 sm:pt-6">
          {query.isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-amber-500 border-r-transparent" />
              <p className="mt-3 text-sm text-gray-500">Loading certificate queue...</p>
            </div>
          ) : query.isError ? (
            <p className="text-sm text-red-600 py-8 text-center">
              {query.error instanceof Error ? query.error.message : 'Failed to load queue'}
            </p>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">No certificates found for current filters.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Skill</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Certificate</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item) => {
                      const statusValue = (item.certificate.status || 'pending') as CertificateStatus;
                      const itemKey = getItemKey(item);
                      const isReviewOpen = expandedReviewItemKey === itemKey;
                      const isReviewed = REVIEWED_STATUSES.includes(statusValue);
                      return [
                        <tr key={itemKey}>
                            <td className="px-3 py-3 text-sm">
                              <div className="font-medium text-gray-900">{item.name || 'Unknown User'}</div>
                              <div className="text-xs text-gray-500">{item.uid}</div>
                              {item.email ? <div className="text-xs text-gray-500">{item.email}</div> : null}
                            </td>
                            <td className="px-3 py-3 text-sm text-gray-700">{item.skillName}</td>
                            <td className="px-3 py-3 text-sm">
                              <div className="font-medium text-gray-900">
                                {item.certificate.certificateType || item.certificate.title || 'Certificate'}
                              </div>
                              {item.certificate.documentUrl ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewDocument({
                                      url: item.certificate.documentUrl as string,
                                      title: item.certificate.certificateType || item.certificate.title || 'Certificate',
                                    })
                                  }
                                  className="inline-flex items-center gap-1 text-xs text-amber-700 hover:underline mt-1"
                                >
                                  View document <ExternalLink className="h-3 w-3" />
                                </button>
                              ) : (
                                <span className="text-xs text-gray-500">No URL</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <Badge className={statusColors[statusValue]}>{statusValue}</Badge>
                            </td>
                            <td className="px-3 py-3">
                              {statusValue === 'pending' ? (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="h-8 bg-green-600 hover:bg-green-700"
                                    onClick={() => {
                                      setReviewNotes('');
                                      setVerifyTarget({
                                        uid: item.uid,
                                        skillIndex: item.skillIndex,
                                        certificateIndex: item.certificateIndex,
                                        title: item.certificate.certificateType || item.certificate.title,
                                        name: item.name,
                                      });
                                    }}
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                    Verify
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-8"
                                    onClick={() => {
                                      setReviewNotes('');
                                      setRejectionReason('');
                                      setRejectTarget({
                                        uid: item.uid,
                                        skillIndex: item.skillIndex,
                                        certificateIndex: item.certificateIndex,
                                        title: item.certificate.certificateType || item.certificate.title,
                                        name: item.name,
                                      });
                                    }}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Reject
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-xs"
                                  onClick={() =>
                                    setExpandedReviewItemKey((prev) => (prev === itemKey ? null : itemKey))
                                  }
                                >
                                  Review history {isReviewOpen ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                                </Button>
                              )}
                            </td>
                          </tr>,
                        isReviewed && isReviewOpen ? (
                          <tr key={`${itemKey}-review`}>
                            <td colSpan={5} className="px-3 pb-3">
                              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                  <div>
                                    <p className="text-gray-500">Reviewed By</p>
                                    <p className="font-medium text-gray-900">{item.certificate.reviewedBy || '-'}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Reviewed At</p>
                                    <p className="font-medium text-gray-900">{formatDateTime(item.certificate.reviewedAt)}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Status</p>
                                    <p className="font-medium text-gray-900 capitalize">{statusValue}</p>
                                  </div>
                                </div>
                                {statusValue === 'rejected' ? (
                                  <div className="mt-2 text-xs">
                                    <p className="text-gray-500">Rejection Reason</p>
                                    <p className="font-medium text-gray-900">{item.certificate.rejectionReason || '-'}</p>
                                  </div>
                                ) : null}
                                <div className="mt-2 text-xs">
                                  <p className="text-gray-500">Review Notes</p>
                                  <p className="font-medium text-gray-900">{item.certificate.reviewNotes || '-'}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null,
                      ];
                    })}
                  </tbody>
                </table>
              </div>

              {pagination && pagination.totalPages > 1 ? (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                  <span className="text-xs sm:text-sm text-gray-600">
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pagination.page <= 1}
                      onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!previewDocument}
        onOpenChange={(open) => {
          if (!open) setPreviewDocument(null);
        }}
      >
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{previewDocument?.title || 'Document Preview'}</DialogTitle>
            <DialogDescription>
              Preview uploaded certificate document.
            </DialogDescription>
          </DialogHeader>
          <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
            {previewDocument?.url ? (
              isPdfUrl(previewDocument.url) ? (
                <iframe
                  src={previewDocument.url}
                  title="Certificate PDF preview"
                  className="w-full h-[70vh]"
                />
              ) : isImageUrl(previewDocument.url) ? (
                <div className="max-h-[70vh] overflow-auto bg-gray-50">
                  <img
                    src={previewDocument.url}
                    alt={previewDocument.title || 'Certificate'}
                    className="w-full h-auto object-contain"
                  />
                </div>
              ) : (
                <div className="p-4 text-sm text-gray-600">
                  Preview is not supported for this file type. Open it in a new tab.
                </div>
              )
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => previewDocument?.url && window.open(previewDocument.url, '_blank')}
            >
              Open in New Tab
            </Button>
            <Button onClick={() => setPreviewDocument(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!verifyTarget}
        onOpenChange={(open) => {
          if (!open) {
            setVerifyTarget(null);
            setReviewNotes('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Certificate</DialogTitle>
            <DialogDescription>
              Confirm verification for {verifyTarget?.name || 'this user'}{verifyTarget?.title ? ` (${verifyTarget.title})` : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="verify-review-notes">Review Notes (optional)</Label>
            <Input
              id="verify-review-notes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Add optional internal note"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyTarget(null)} disabled={verifyMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => verifyTarget && verifyMutation.mutate(verifyTarget)}
              disabled={verifyMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {verifyMutation.isPending ? 'Verifying...' : 'Confirm Verify'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setReviewNotes('');
            setRejectionReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Certificate</DialogTitle>
            <DialogDescription>
              Provide a rejection reason for {rejectTarget?.name || 'this user'}{rejectTarget?.title ? ` (${rejectTarget.title})` : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Rejection Reason *</Label>
            <Input
              id="reject-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reject-review-notes">Review Notes (optional)</Label>
            <Input
              id="reject-review-notes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Additional internal context"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={rejectMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectTarget && rejectMutation.mutate(rejectTarget)}
              disabled={rejectMutation.isPending || !rejectionReason.trim()}
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
