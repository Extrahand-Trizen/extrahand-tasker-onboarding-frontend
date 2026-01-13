'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { caosApi, type Lead, type LeadStatus } from '@/lib/api/caos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock, Eye, FileText, Loader2, Search, Filter } from 'lucide-react';
import Link from 'next/link';
import { leadStatusLabel } from '@/lib/leadLabels';

const documentTypeLabels: Record<Lead['documents'][0]['type'], string> = {
  aadhaar: 'Aadhaar',
  pan: 'PAN',
  address_proof: 'Address Proof',
  skill_certificate: 'Skill Certificate',
  photo: 'Photo',
  other: 'Other',
};

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

const docTypeColors: Record<Lead['documents'][0]['type'], string> = {
  aadhaar: 'bg-blue-100 text-blue-800',
  pan: 'bg-purple-100 text-purple-800',
  address_proof: 'bg-green-100 text-green-800',
  skill_certificate: 'bg-yellow-100 text-yellow-800',
  photo: 'bg-pink-100 text-pink-800',
  other: 'bg-gray-100 text-gray-800',
};

export default function VerificationQueuePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchCity, setSearchCity] = useState('');
  const [documentTypeFilter, setDocumentTypeFilter] = useState<Lead['documents'][0]['type'] | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['verification-queue', { searchCity, documentTypeFilter, statusFilter, page }],
    queryFn: () =>
      caosApi.getVerificationQueue({
        city: searchCity || undefined,
        documentType: documentTypeFilter !== 'all' ? documentTypeFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        page,
        limit,
      }),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ leadId, docIndex, status, rejectionReason }: {
      leadId: string;
      docIndex: number;
      status: 'verified' | 'rejected';
      rejectionReason?: string;
    }) => caosApi.verifyDocument(leadId, docIndex, status, rejectionReason),
    onSuccess: () => {
      toast.success('Document verified successfully');
      queryClient.invalidateQueries({ queryKey: ['verification-queue'] });
      queryClient.invalidateQueries({ queryKey: ['lead'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to verify document');
    },
  });

  const handleQuickVerify = (leadId: string, docIndex: number) => {
    if (confirm('Mark this document as verified?')) {
      verifyMutation.mutate({ leadId, docIndex, status: 'verified' });
    }
  };

  const handleQuickReject = (leadId: string, docIndex: number) => {
    const reason = prompt('Enter rejection reason:');
    if (reason && reason.trim()) {
      verifyMutation.mutate({ leadId, docIndex, status: 'rejected', rejectionReason: reason.trim() });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const leads = data?.data.leads || [];
  const pagination = data?.data.pagination;

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Document Verification Queue</h1>
        <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm text-gray-500">
          Review and verify documents uploaded by the marketing team
        </p>
      </div>

      {/* Filters */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="pt-4 sm:pt-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Filter by city..."
                value={searchCity}
                onChange={(e) => {
                  setSearchCity(e.target.value);
                  setPage(1);
                }}
                className="pl-10 border-gray-300"
              />
            </div>

            <Select
              value={documentTypeFilter}
              onValueChange={(value) => {
                setDocumentTypeFilter(value as Lead['documents'][0]['type'] | 'all');
                setPage(1);
              }}
            >
              <SelectTrigger className="border-gray-300">
                <SelectValue placeholder="All Document Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Document Types</SelectItem>
                <SelectItem value="aadhaar">Aadhaar</SelectItem>
                <SelectItem value="pan">PAN</SelectItem>
                <SelectItem value="address_proof">Address Proof</SelectItem>
                <SelectItem value="skill_certificate">Skill Certificate</SelectItem>
                <SelectItem value="photo">Photo</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

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
                <SelectItem value="documents_submitted">Documents Submitted</SelectItem>
                <SelectItem value="under_verification">Under Verification</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => {
                setSearchCity('');
                setDocumentTypeFilter('all');
                setStatusFilter('all');
                setPage(1);
              }}
              className="w-full sm:w-auto"
            >
              <Filter className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Verification Queue */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle>
            Pending Documents ({pagination?.total || 0} leads)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No pending documents to verify</p>
            </div>
          ) : (
            <div className="space-y-4">
              {leads.map((lead) => (
                <div
                  key={lead.leadId}
                  className="border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-3 mb-3">
                    <div className="flex-1 w-full">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                        <Link
                          href={`/leads/${lead.leadId}?from=verification`}
                          className="font-semibold text-base sm:text-lg hover:underline text-gray-900"
                        >
                          {lead.name}
                        </Link>
                        <div className="flex items-center gap-2">
                          <Badge className={statusColors[lead.status]}>
                            {leadStatusLabel(lead.status)}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/leads/${lead.leadId}?from=verification`)}
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Phone:</span> {lead.phone}
                        </div>
                        <div>
                          <span className="font-medium">City:</span> {lead.city}
                        </div>
                        <div>
                          <span className="font-medium">Skill:</span> {lead.primaryCategory}
                        </div>
                        <div>
                          <span className="font-medium">ID:</span> {lead.leadId.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pending Documents */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      Pending Documents ({lead.pendingDocuments?.length || 0})
                    </p>
                    <div className="space-y-2">
                      {lead.pendingDocuments?.map((doc) => (
                        <div
                          key={doc.index}
                          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                        >
                          <div className="flex items-center gap-2 sm:gap-3 flex-1 w-full">
                            <FileText className="h-5 w-5 text-yellow-600" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge className={docTypeColors[doc.type]}>
                                  {documentTypeLabels[doc.type]}
                                </Badge>
                                <Badge className="bg-yellow-100 text-yellow-800">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Pending
                                </Badge>
                                {doc.uploadedAt && (
                                  <span className="text-xs text-gray-500">
                                    Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                            {doc.url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(doc.url, '_blank')}
                                title="View document"
                                className="flex-1 sm:flex-none"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleQuickVerify(lead.leadId, doc.index)}
                              disabled={verifyMutation.isPending}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50 flex-1 sm:flex-none"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Verify
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleQuickReject(lead.leadId, doc.index)}
                              disabled={verifyMutation.isPending}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-1 sm:flex-none"
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/leads/${lead.leadId}?from=verification`)}
                              className="text-amber-600 hover:text-amber-700 w-full sm:w-auto"
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

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
        </CardContent>
      </Card>
    </div>
  );
}

