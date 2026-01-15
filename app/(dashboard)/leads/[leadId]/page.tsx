'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { caosApi, type LeadStatus } from '@/lib/api/caos';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Phone, Mail, MapPin, Briefcase, Calendar, User, 
  MessageSquare, Clock, CheckCircle, XCircle,
  ArrowLeft, Edit
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { DocumentsSection } from '@/components/leads/DocumentsSection';
import { SkillsSection } from '@/components/leads/SkillsSection';
import { leadStatusLabel } from '@/lib/leadLabels';

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

export default function LeadDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const leadId = params.leadId as string;
  const queryClient = useQueryClient();
  const { role, loading: authLoading } = useJWTAuth();
  const fromVerification = searchParams?.get('from') === 'verification';
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<LeadStatus>('contacted');
  const [statusNotes, setStatusNotes] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');

  // ✅ Role-based permissions
  // Lead Access Manager can move to ANY stage (full access)
  // Qualifier can only move stages up to "interested" (Onboarder handles documents)
  // Onboarder can move to any stage (full access)
  // Wait for auth to load before showing/hiding button
  const isLeadAccessManager = !authLoading && role === 'lead_access_manager';
  const isQualifier = !authLoading && role === 'qualifier';
  const isOnboarder = !authLoading && role === 'onboarder';
  const canMoveStage = !authLoading && (isLeadAccessManager || isQualifier || isOnboarder);
  
  // ✅ Qualifier team can only move stages up to "interested"
  // Admin and Operations can move to ANY stage
  const qualifierAllowedStatuses: LeadStatus[] = [
    'lead_added',
    'contacted',
    'interested'
  ];
  
  // ✅ All available statuses (for admin and onboarder)
  const allStatuses: LeadStatus[] = [
    'lead_added',
    'contacted',
    'interested',
    'documents_submitted',
    'under_verification',
    'approved',
    'rejected',
    'inactive'
    // ❌ REMOVED: 'account_created', 'activated' - these are account statuses, not lead statuses
  ];
  
  // Debug: Log role for troubleshooting
  useEffect(() => {
    console.log('[Lead Detail] Auth loading:', authLoading);
    console.log('[Lead Detail] Current user role:', role);
    console.log('[Lead Detail] Can move stage:', canMoveStage);
  }, [role, authLoading, canMoveStage]);

  const { data: leadData, isLoading } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => caosApi.getLead(leadId),
    enabled: !!leadId,
  });

  const lead = leadData?.data;
  const isBulkUpload = lead?.creationMethod === 'bulk_upload';

  // Update newStatus when lead loads
  useEffect(() => {
    if (lead) {
      setNewStatus(lead.status);
    }
  }, [lead]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, notes }: { status: LeadStatus; notes?: string }) => {
      // ✅ Double-check permission before making API call
      if (!canMoveStage) {
        toast.error('You do not have permission to move stages. Only qualifier team can update lead status.');
        throw new Error('Unauthorized: Only qualifier team can move stages');
      }
      
      // ✅ Qualifier can only set status up to interested
      // ✅ FIX: Only restrict qualifier team, not admin/onboarder
      if (isQualifier && !qualifierAllowedStatuses.includes(status)) {
        toast.error(`Qualifier team can only move stages up to "Interested". After that, the verification team takes over.`);
        throw new Error('Invalid status: Qualifier team cannot set this status');
      }
      
      // No auto-transition needed since qualifier cannot set documents_submitted
      return caosApi.updateStatus(leadId, status, notes);
    },
    onSuccess: (data, variables) => {
      toast.success('Status updated successfully');
      setShowStatusModal(false);
      setStatusNotes('');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['verification-queue'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update status');
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (note: string) => caosApi.addNote(leadId, note),
    onSuccess: () => {
      toast.success('Note added successfully');
      setShowNoteModal(false);
      setNoteText('');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add note');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-600">Loading tasker details...</p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Tasker not found</p>
        <Link href="/leads">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Partner List
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {fromVerification ? (
            <Link href="/leads/verification">
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Verification Queue
              </Button>
            </Link>
          ) : (
            <Link href="/leads">
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{lead.name}</h1>
            <p className="text-sm text-gray-500">Tasker ID: {lead.leadId}</p>
          </div>
        </div>
        {!isBulkUpload && (
          <div className="flex gap-2">
            {/* ✅ Only qualifier team can move stages */}
            {canMoveStage && (
              <Button
                variant="outline"
                onClick={() => {
                  // ✅ Admin, Operations, and Qualifier can all move stages
                  if (lead) {
                    setNewStatus(lead.status);
                  }
                  setShowStatusModal(true);
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Move Stage
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setShowNoteModal(true)}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Information */}
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-medium">{lead.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="font-medium">{lead.phone}</p>
              </div>
            </div>
            {lead.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{lead.email}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">City</p>
                <p className="font-medium">{lead.city}</p>
              </div>
            </div>
            {lead.state && (
              <div>
                <p className="text-sm text-gray-600">State</p>
                <p className="font-medium">{lead.state}</p>
              </div>
            )}
            {lead.address && (
              <div>
                <p className="text-sm text-gray-600">Address</p>
                <p className="font-medium">{lead.address}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status & Stage */}
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Onboarding Stage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">Current Status</p>
              <Badge className={statusColors[lead.status]}>
                {leadStatusLabel(lead.status)}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Primary Category</p>
              <p className="font-medium">{lead.primaryCategory}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Source</p>
              <p className="font-medium capitalize">{lead.source}</p>
            </div>
            {lead.sourceDetails && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Source Details</p>
                <p className="font-medium">{lead.sourceDetails}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-600 mb-2">Added By</p>
              <p className="font-medium">{lead.addedByName || lead.addedBy}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Created</p>
              <p className="font-medium">
                {new Date(lead.createdAt).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Onboarding Checklist - Hidden for bulk upload taskers */}
      {!isBulkUpload && (() => {
        const hasAadhaar = lead.documents?.some((d) => d.type === 'aadhaar') || false;
        const hasPan = lead.documents?.some((d) => d.type === 'pan') || false;
        const hasAddress = lead.documents?.some((d) => d.type === 'address_proof') || false;

        const verifiedAadhaar = lead.documents?.find((d) => d.type === 'aadhaar')?.status === 'verified';
        const verifiedPan = lead.documents?.find((d) => d.type === 'pan')?.status === 'verified';
        const verifiedAddress = lead.documents?.find((d) => d.type === 'address_proof')?.status === 'verified';

        const hasRequiredDocs = hasAadhaar && hasPan && hasAddress;
        const hasVerifiedDocs = verifiedAadhaar && verifiedPan && verifiedAddress;
        const hasSkills = (lead.skills?.length || 0) > 0 || !!lead.primaryCategory;
        const hasRequiredFields = !!(lead.name && lead.phone && lead.city && lead.primaryCategory);
        const isOkFlags = !lead.isDuplicate && !lead.blacklisted;
        // ✅ UPDATED: Check lead status only (activation is tracked via accountStatus)
        const isApproved = lead.status === 'approved';
        const isActivated = lead.accountStatus === 'activated' || !!lead.activationData?.firebaseUid;

        const items: Array<{ label: string; ok: boolean; hint?: string }> = [
          { label: 'Required fields present (name, phone, city, primary category)', ok: hasRequiredFields },
          { label: 'Documents uploaded (optional)', ok: hasRequiredDocs || lead.documents?.length === 0, hint: 'Documents are optional - Aadhaar, PAN, or Address proof can be uploaded' },
          { label: 'Uploaded documents verified', ok: hasVerifiedDocs || !hasRequiredDocs, hint: 'Documents are auto-verified on upload' },
          { label: 'Skills assigned', ok: hasSkills },
          { label: 'Not marked duplicate / not blacklisted', ok: isOkFlags },
          { label: 'Approved', ok: isApproved, hint: 'Must be manually approved by verification team' },
          { label: 'Account created', ok: isActivated, hint: 'Use "Create Accounts" to activate' },
        ];

        return (
          <Card className="border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">Onboarding Checklist</CardTitle>
              <CardDescription className="text-sm text-gray-500">Complete these steps to finish onboarding</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((it) => (
                <div key={it.label} className="flex items-start gap-3">
                  {it.ok ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{it.label}</p>
                    {!it.ok && it.hint && <p className="text-xs text-gray-600 mt-0.5">{it.hint}</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })()}

      {/* Status History / Timeline - Hidden for bulk upload taskers */}
      {!isBulkUpload && (
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lead.statusHistory.map((history, idx) => (
                <div key={idx} className="flex items-start gap-4 pb-3 border-b last:border-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={statusColors[history.status]}>
                        {leadStatusLabel(history.status)}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        by {history.changedByName || history.changedBy}
                      </span>
                    </div>
                    {history.notes && (
                      <p className="text-sm text-gray-600 mt-1">{history.notes}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(history.changedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents Section */}
      <DocumentsSection lead={lead} leadId={leadId} />

      {/* Skills Section */}
      <SkillsSection lead={lead} leadId={leadId} />

      {/* Internal Notes */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Internal Notes</CardTitle>
        </CardHeader>
        <CardContent>
          {lead.internalNotes.length === 0 ? (
            <p className="text-sm text-gray-600">No notes yet</p>
          ) : (
            <div className="space-y-3">
              {lead.internalNotes.map((note, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">
                      {note.addedByName || note.addedBy}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(note.addedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{note.note}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Update Modal - Only visible to qualifier team */}
      {showStatusModal && canMoveStage && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowStatusModal(false);
              setStatusNotes('');
            }
          }}
        >
          <Card className="w-full max-w-md bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">Move Stage</CardTitle>
              {isQualifier && (
                <p className="text-sm text-gray-600 mt-1">
                  You can move stages up to "Interested". After that, the verification team will review and approve.
                </p>
              )}
              {(isLeadAccessManager || isOnboarder) && (
                <p className="text-sm text-gray-600 mt-1">
                  You have full access to move leads to any stage.
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status-select">New Status</Label>
                <Select
                  value={newStatus}
                  onValueChange={(value) => {
                    const selectedStatus = value as LeadStatus;
                    // ✅ Only restrict qualifier team - admin and onboarder can select any status
                    if (isQualifier && !qualifierAllowedStatuses.includes(selectedStatus)) {
                      toast.error('Qualifier team can only move stages up to "Interested". Onboarder team will handle document collection.');
                      return;
                    }
                    setNewStatus(selectedStatus);
                  }}
                >
                  <SelectTrigger id="status-select">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {/* ✅ Qualifier team can only select up to "Interested" */}
                    {/* ✅ Admin and Operations can select ANY status */}
                    {isQualifier ? (
                      <>
                        <SelectItem value="lead_added">New Tasker</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="interested">Interested</SelectItem>
                      </>
                    ) : (
                      <>
                        {/* ✅ Admin and Operations: Full access to all statuses */}
                        <SelectItem value="lead_added">New Tasker</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="interested">Interested</SelectItem>
                        <SelectItem value="documents_submitted">Documents Received</SelectItem>
                        <SelectItem value="under_verification">Under Verification</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        {/* ❌ REMOVED: account_created, activated - these are account statuses, not lead statuses */}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status-notes">Notes (Optional)</Label>
                <Textarea
                  id="status-notes"
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Add notes about this status change..."
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => {
                    updateStatusMutation.mutate({ status: newStatus, notes: statusNotes });
                  }}
                  disabled={updateStatusMutation.isPending}
                  className="flex-1"
                >
                  {updateStatusMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowStatusModal(false);
                    setStatusNotes('');
                  }}
                  disabled={updateStatusMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Note Modal */}
      {showNoteModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNoteModal(false);
              setNoteText('');
            }
          }}
        >
          <Card className="w-full max-w-md bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">Add Internal Note</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="note-textarea">Note</Label>
                <Textarea
                  id="note-textarea"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Enter your note..."
                  rows={4}
                  className="resize-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => {
                    if (noteText.trim()) {
                      addNoteMutation.mutate(noteText);
                    }
                  }}
                  disabled={addNoteMutation.isPending || !noteText.trim()}
                  className="flex-1"
                >
                  {addNoteMutation.isPending ? 'Adding...' : 'Add Note'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNoteModal(false);
                    setNoteText('');
                  }}
                  disabled={addNoteMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

