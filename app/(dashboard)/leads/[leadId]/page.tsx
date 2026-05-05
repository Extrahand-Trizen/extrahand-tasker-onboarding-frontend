'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { caosApi, type LeadStatus, type LeadSource } from '@/lib/api/caos';
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
  ArrowLeft, Edit, Trash2, RefreshCw, UserCheck, Award
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { SkillsSection } from '@/components/leads/SkillsSection';
import { leadStatusLabel, categoryDisplay } from '@/lib/leadLabels';

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

const reasonCodeLabelMap: Record<string, string> = {
  callback_requested: 'Callback requested',
  interested_onboarding_later: 'Interested - onboarding later',
  not_interested: 'Not interested',
  wrong_number: 'Wrong number',
  other: 'Other',
};

const statusReasonCodeMap: Partial<Record<LeadStatus, string[]>> = {
  contacted_interested: ['callback_requested', 'interested_onboarding_later', 'other'],
  contacted_not_interested: ['not_interested', 'wrong_number', 'other'],
};

/** Card showing whether lead has registered on main website and verified Aadhaar */
function ConversionStatusCard({
  leadId,
  lead,
  queryClient,
}: {
  leadId: string;
  lead: {
    phone?: string;
    landline?: string;
    accountStatus?: 'not_created' | 'invited' | 'activated' | 'suspended';
    activationData?: { firebaseUid?: string };
    verificationStatus?: { aadhaar?: { status?: 'pending' | 'verified' | 'failed' } };
    conversionData?: { platformUid?: string; isAadhaarVerified?: boolean; lastCheckedAt?: string };
  };
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const hasPhone = !!(lead?.phone || (lead as any)?.landline);
  const conversionDataSnapshot = lead?.conversionData;
  const isRegisteredOnPlatform =
    !!conversionDataSnapshot?.platformUid ||
    !!lead?.activationData?.firebaseUid ||
    ['invited', 'activated', 'suspended'].includes(lead?.accountStatus || 'not_created');
  const isVerified = !!conversionDataSnapshot?.isAadhaarVerified || lead?.verificationStatus?.aadhaar?.status === 'verified';

  const autoRefreshQuery = useQuery({
    queryKey: ['lead', leadId, 'conversion-status-auto', conversionDataSnapshot?.lastCheckedAt, isRegisteredOnPlatform, isVerified],
    queryFn: () => caosApi.getConversionStatus(leadId),
    enabled: hasPhone && isRegisteredOnPlatform && !isVerified,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    retry: 1,
  });

  useEffect(() => {
    if (!autoRefreshQuery.dataUpdatedAt) {
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['lead', leadId] });

    if (autoRefreshQuery.data?.data?.isAadhaarVerified) {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId, 'verified-certificates'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['interested-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['registered-candidates'] });
    }
  }, [
    autoRefreshQuery.data,
    autoRefreshQuery.dataUpdatedAt,
    leadId,
    queryClient,
  ]);

  const checkMutation = useMutation({
    mutationFn: () => caosApi.getConversionStatus(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead', leadId, 'verified-certificates'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['interested-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['registered-candidates'] });
      toast.success('Status updated');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to check status');
    },
  });

  let statusLabel: string;
  let statusBadgeClass: string;
  if (!isRegisteredOnPlatform) {
    statusLabel = 'Not registered';
    statusBadgeClass = 'bg-gray-100 text-gray-800';
  } else if (!isVerified) {
    statusLabel = 'Registered';
    statusBadgeClass = 'bg-amber-100 text-amber-800';
  } else {
    statusLabel = 'Registered and verified';
    statusBadgeClass = 'bg-green-100 text-green-800';
  }

  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-gray-500" />
          Platform status
        </CardTitle>
        <CardDescription className="text-sm text-gray-500">
          Registration and Aadhaar verification status on the main website
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm text-gray-600 mb-1">Status</p>
          <Badge className={statusBadgeClass}>{statusLabel}</Badge>
        </div>
        {conversionDataSnapshot?.platformUid && (
          <div>
            <p className="text-sm text-gray-600 mb-1">Platform user ID</p>
            <p className="font-mono text-xs text-gray-700 break-all">{conversionDataSnapshot.platformUid}</p>
          </div>
        )}
        {conversionDataSnapshot?.lastCheckedAt && (
          <p className="text-xs text-gray-500">
            Last checked: {new Date(conversionDataSnapshot.lastCheckedAt).toLocaleString()}
          </p>
        )}
        {hasPhone && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkMutation.mutate()}
            disabled={checkMutation.isPending}
          >
            {checkMutation.isPending ? (
              <>Checking…</>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Check status
              </>
            )}
          </Button>
        )}
        {!hasPhone && (
          <p className="text-sm text-amber-700">No phone number – cannot check registration status</p>
        )}
      </CardContent>
    </Card>
  );
}

function VerifiedCertificatesCard({ leadId }: { leadId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['lead', leadId, 'verified-certificates'],
    queryFn: () => caosApi.getVerifiedCertificates(leadId),
    enabled: !!leadId,
  });

  const certificates = data?.data?.certificates || [];

  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Award className="h-5 w-5 text-gray-500" />
          Verified skill certificates
        </CardTitle>
        <CardDescription className="text-sm text-gray-500">
          Skill certificates verified for this tasker on ExtraHand platform
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading verified certificates...</p>
        ) : certificates.length === 0 ? (
          <p className="text-sm text-gray-500">
            No verified skill certificates found.
          </p>
        ) : (
          <div className="space-y-3">
            {certificates.map((certificate, index) => (
              <div key={`${certificate.skillName}-${index}`} className="rounded-md border border-gray-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{certificate.skillName}</p>
                  <Badge className="bg-green-100 text-green-800">Verified</Badge>
                </div>
                {certificate.certificateType && (
                  <p className="mt-1 text-xs text-gray-600">
                    Certificate: {certificate.certificateType}
                  </p>
                )}
                {certificate.issuingAuthority && (
                  <p className="text-xs text-gray-600">
                    Issued by: {certificate.issuingAuthority}
                  </p>
                )}
                {certificate.reviewedAt && (
                  <p className="text-xs text-gray-500 mt-1">
                    Verified on: {new Date(certificate.reviewedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LeadDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const leadId = params.leadId as string;
  const queryClient = useQueryClient();
  const { role, user, loading: authLoading } = useJWTAuth();
  const fromVerification = searchParams?.get('from') === 'verification';
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<LeadStatus>('contacted_not_interested');
  const [statusNotes, setStatusNotes] = useState('');
  const [statusReasonCode, setStatusReasonCode] = useState('');
  const [callbackAt, setCallbackAt] = useState('');
  const [expectedOnboardingAt, setExpectedOnboardingAt] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    email: string;
    city: string;
    state: string;
    address: string;
    pincode: string;
    primaryCategory: string;
    secondaryCategory: string;
    source: LeadSource | '';
    sourceDetails: string;
  }>({
    name: '',
    email: '',
    city: '',
    state: '',
    address: '',
    pincode: '',
    primaryCategory: '',
    secondaryCategory: '',
    source: '',
    sourceDetails: '',
  });

  // ✅ Role-based permissions
  // Lead Access Manager can move to ANY stage (full access)
  // Qualifier can only move stages up to "Contacted & Interested"
  // Onboarder can move to any stage (full access)
  // Wait for auth to load before showing/hiding button
  const isLeadAccessManager = !authLoading && role === 'lead_access_manager';
  const isQualifier = !authLoading && role === 'qualifier';
  const isOnboarder = !authLoading && role === 'onboarder';
  const canMoveStage = !authLoading && (isLeadAccessManager || isQualifier || isOnboarder);
  const canDeleteLead = !authLoading && isLeadAccessManager;
  
  // ✅ Qualifier team can only move stages up to "Contacted & Interested"
  const qualifierAllowedStatuses: LeadStatus[] = [
    'lead_added',
    'contacted_not_lifted',
    'contacted_not_interested',
    'contacted_interested'
  ];
  
  // ✅ All available statuses (for admin and onboarder) — no documents/verification stages
  const allStatuses: LeadStatus[] = [
    'lead_added',
    'contacted_not_lifted',
    'contacted_not_interested',
    'contacted_interested',
    'approved'
    // inactive: not offered in Move Stage (can still be set elsewhere if needed)
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
  const { data: statusReasonCodesData } = useQuery({
    queryKey: ['lead-status-reason-codes'],
    queryFn: () => caosApi.getStatusReasonCodes(),
  });

  const lead = leadData?.data;
  const statusReasonOptions = statusReasonCodesData?.data || [];
  const allowedReasonCodesForStatus = statusReasonCodeMap[newStatus] || [];
  const filteredStatusReasonOptions = statusReasonOptions.filter((code) =>
    allowedReasonCodesForStatus.includes(code)
  );
  const showReasonFields = filteredStatusReasonOptions.length > 0;
  const showCallbackDateField =
    (newStatus === 'contacted_interested' && statusReasonCode === 'callback_requested') ||
    newStatus === 'contacted_not_lifted';
  const showExpectedOnboardingField =
    newStatus === 'contacted_interested' && statusReasonCode === 'interested_onboarding_later';
  const isBulkUpload = lead?.creationMethod === 'bulk_upload';
  const canUpdateLead = !authLoading && (isLeadAccessManager || isOnboarder || isQualifier);

  // Update newStatus when lead loads
  useEffect(() => {
    if (lead) {
      setNewStatus(lead.status);
    }
  }, [lead]);

  useEffect(() => {
    if (!filteredStatusReasonOptions.includes(statusReasonCode)) {
      setStatusReasonCode('');
    }
    if (!showCallbackDateField) {
      setCallbackAt('');
    }
    if (!showExpectedOnboardingField) {
      setExpectedOnboardingAt('');
    }
  }, [
    statusReasonCode,
    filteredStatusReasonOptions,
    showCallbackDateField,
    showExpectedOnboardingField,
  ]);

  // Initialize edit form data when lead loads or edit modal opens
  useEffect(() => {
    if (lead && showEditModal) {
      setEditFormData({
        name: lead.name || '',
        email: lead.email || '',
        city: lead.city || '',
        state: lead.state || '',
        address: lead.address || '',
        pincode: (lead as any).pincode || '',
        primaryCategory: lead.primaryCategory || (lead as any).primarySkill || '',
        secondaryCategory: lead.secondaryCategory || (lead as any).secondarySkill || '',
        source: lead.source || '',
        sourceDetails: lead.sourceDetails || '',
      });
    }
  }, [lead, showEditModal]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      status,
      notes,
      statusReasonCode,
      callbackAt,
      expectedOnboardingAt,
    }: {
      status: LeadStatus;
      notes?: string;
      statusReasonCode?: string;
      callbackAt?: string;
      expectedOnboardingAt?: string;
    }) => {
      // ✅ Double-check permission before making API call
      if (!canMoveStage) {
        toast.error('You do not have permission to move stages. Only qualifier team can update lead status.');
        throw new Error('Unauthorized: Only qualifier team can move stages');
      }
      
      // ✅ Qualifier can only set status up to Contacted & Interested
      if (isQualifier && !qualifierAllowedStatuses.includes(status)) {
        toast.error(`Qualifier team can only move stages up to "Contacted & Interested". After that, the verification team takes over.`);
        throw new Error('Invalid status: Qualifier team cannot set this status');
      }

      if ((statusReasonCode === 'callback_requested' || newStatus === 'contacted_not_lifted') && !callbackAt) {
        toast.error('Callback date is required when reason is callback requested.');
        throw new Error('callbackAt is required');
      }

      // No auto-transition needed since qualifier cannot set documents_submitted
      return caosApi.updateStatus(leadId, status, notes, {
        statusReasonCode: statusReasonCode || undefined,
        statusReasonText: undefined,
        callbackAt: showCallbackDateField ? callbackAt || undefined : undefined,
        expectedOnboardingAt: showExpectedOnboardingField ? expectedOnboardingAt || undefined : undefined,
      });
    },
    onSuccess: (data, variables) => {
      toast.success('Status updated successfully');
      setShowStatusModal(false);
      setStatusNotes('');
      setStatusReasonCode('');
      setCallbackAt('');
      setExpectedOnboardingAt('');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
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

  const updateLeadMutation = useMutation({
    mutationFn: (data: typeof editFormData) => {
      // Map primaryCategory to primarySkill for API compatibility
      const updateData: any = {
        name: data.name.trim(),
        email: data.email.trim() || null,
        city: data.city.trim() || null,
        state: data.state.trim() || null,
        address: data.address.trim() || null,
        pincode: data.pincode.trim() || null,
        primarySkill: data.primaryCategory.trim() || null,
        secondarySkill: data.secondaryCategory.trim() || null,
        source: data.source || null,
        sourceDetails: data.sourceDetails.trim() || null,
      };
      return caosApi.updateLead(leadId, updateData);
    },
    onSuccess: () => {
      toast.success('Lead updated successfully');
      setShowEditModal(false);
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update lead');
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: () => caosApi.deleteLead(leadId),
    onSuccess: () => {
      toast.success('Lead deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      // Redirect to leads list
      window.location.href = '/leads';
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete lead');
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
            Back to Leads List
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
        <div className="flex gap-2">
          {/* Edit Lead: qualifier can edit only own leads; onboarder/admin can edit all */}
          {canUpdateLead && (
            <Button
              variant="outline"
              onClick={() => setShowEditModal(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Lead
            </Button>
          )}
          {/* ✅ Delete Lead button - visible only to lead_access_manager and only for non-bulk-upload leads */}
          {canDeleteLead && !isBulkUpload && (
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(true)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Lead
            </Button>
          )}
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
              <p className="text-sm text-gray-600 mb-2">Category</p>
              <p className="font-medium">
                {categoryDisplay(lead.primaryCategory || (lead as any).primarySkill, lead.secondaryCategory || (lead as any).secondarySkill)}
              </p>
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

        {/* Platform status (converted & verified on main website) */}
        <ConversionStatusCard leadId={leadId} lead={lead} queryClient={queryClient} />

        {/* Verified skill certificates (from mobile/website profile) */}
        <VerifiedCertificatesCard leadId={leadId} />
      </div>

      {/* Onboarding Checklist - Hidden for bulk upload taskers */}
      {/* {!isBulkUpload && (() => {
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
      })()} */}

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
              setStatusReasonCode('');
              setCallbackAt('');
              setExpectedOnboardingAt('');
            }
          }}
        >
          <Card className="w-full max-w-md bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">Move Stage</CardTitle>
              {isQualifier && (
                <p className="text-sm text-gray-600 mt-1">
                  You can move stages up to &quot;Contacted & Interested&quot;. After that, the verification team will review and approve.
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
                      toast.error('Qualifier team can only move stages up to "Contacted & Interested". Onboarder team will handle the rest.');
                      return;
                    }
                    setNewStatus(selectedStatus);
                    setStatusReasonCode('');
                    setCallbackAt('');
                    setExpectedOnboardingAt('');
                  }}
                >
                  <SelectTrigger id="status-select">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {isQualifier ? (
                      <>
                        <SelectItem value="lead_added">{leadStatusLabel('lead_added')}</SelectItem>
                        <SelectItem value="contacted_not_lifted">{leadStatusLabel('contacted_not_lifted')}</SelectItem>
                        <SelectItem value="contacted_not_interested">{leadStatusLabel('contacted_not_interested')}</SelectItem>
                        <SelectItem value="contacted_interested">{leadStatusLabel('contacted_interested')}</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="lead_added">{leadStatusLabel('lead_added')}</SelectItem>
                        <SelectItem value="contacted_not_lifted">{leadStatusLabel('contacted_not_lifted')}</SelectItem>
                        <SelectItem value="contacted_not_interested">{leadStatusLabel('contacted_not_interested')}</SelectItem>
                        <SelectItem value="contacted_interested">{leadStatusLabel('contacted_interested')}</SelectItem>
                        <SelectItem value="approved">{leadStatusLabel('approved')}</SelectItem>
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
              {showReasonFields && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="status-reason-code">Reason</Label>
                    <Select
                      value={statusReasonCode || '__none__'}
                      onValueChange={(value) => setStatusReasonCode(value === '__none__' ? '' : value)}
                    >
                      <SelectTrigger id="status-reason-code">
                        <SelectValue placeholder="Select reason (optional)" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="__none__">None</SelectItem>
                        {filteredStatusReasonOptions.map((code) => (
                          <SelectItem key={code} value={code}>
                            {reasonCodeLabelMap[code] || code.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              {showCallbackDateField && (
                <div className="space-y-2">
                  <Label htmlFor="callback-at">Callback Date *</Label>
                  <Input
                    id="callback-at"
                    type="datetime-local"
                    value={callbackAt}
                    onChange={(e) => setCallbackAt(e.target.value)}
                  />
                </div>
              )}
              {showExpectedOnboardingField && (
                <div className="space-y-2">
                  <Label htmlFor="expected-onboarding-at">Expected Onboarding Date (Optional)</Label>
                  <Input
                    id="expected-onboarding-at"
                    type="datetime-local"
                    value={expectedOnboardingAt}
                    onChange={(e) => setExpectedOnboardingAt(e.target.value)}
                  />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => {
                    updateStatusMutation.mutate({
                      status: newStatus,
                      notes: statusNotes,
                      statusReasonCode,
                      callbackAt,
                      expectedOnboardingAt,
                    });
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
                    setStatusReasonCode('');
                    setCallbackAt('');
                    setExpectedOnboardingAt('');
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

      {/* Edit Lead Modal */}
      {showEditModal && canUpdateLead && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEditModal(false);
            }
          }}
        >
          <Card className="w-full max-w-2xl bg-white shadow-xl my-8" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">Edit Lead Details</CardTitle>
              <CardDescription className="text-sm text-gray-500">
                Update lead information. Phone number cannot be changed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    placeholder="Full Name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-city">City</Label>
                  <Input
                    id="edit-city"
                    value={editFormData.city}
                    onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                    placeholder="City"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-state">State</Label>
                  <Input
                    id="edit-state"
                    value={editFormData.state}
                    onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                    placeholder="State"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Input
                    id="edit-address"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    placeholder="Local Area / Address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-pincode">Pincode</Label>
                  <Input
                    id="edit-pincode"
                    value={editFormData.pincode}
                    onChange={(e) => setEditFormData({ ...editFormData, pincode: e.target.value })}
                    placeholder="6-digit pincode"
                    maxLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-primary-category">Primary Category</Label>
                  <Input
                    id="edit-primary-category"
                    value={editFormData.primaryCategory}
                    onChange={(e) => setEditFormData({ ...editFormData, primaryCategory: e.target.value })}
                    placeholder="e.g., cleaning, handyperson"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-secondary-category">Secondary Category</Label>
                  <Input
                    id="edit-secondary-category"
                    value={editFormData.secondaryCategory}
                    onChange={(e) => setEditFormData({ ...editFormData, secondaryCategory: e.target.value })}
                    placeholder="e.g., deep cleaning, plumbing"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-source">Source</Label>
                  <Select
                    value={editFormData.source || '__none__'}
                    onValueChange={(value) => setEditFormData({ ...editFormData, source: value === '__none__' ? '' : (value as LeadSource) })}
                  >
                    <SelectTrigger id="edit-source">
                      <SelectValue placeholder="Select source (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="campaign">Campaign</SelectItem>
                      <SelectItem value="walk-in">Walk-in</SelectItem>
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="edit-source-details">Source Details</Label>
                  <Input
                    id="edit-source-details"
                    value={editFormData.sourceDetails}
                    onChange={(e) => setEditFormData({ ...editFormData, sourceDetails: e.target.value })}
                    placeholder="Additional details about the source"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => {
                    if (!editFormData.name.trim()) {
                      toast.error('Name is required');
                      return;
                    }
                    updateLeadMutation.mutate(editFormData);
                  }}
                  disabled={updateLeadMutation.isPending}
                  className="flex-1"
                >
                  {updateLeadMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                  disabled={updateLeadMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Lead Confirmation Modal */}
      {showDeleteModal && canDeleteLead && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDeleteModal(false);
            }
          }}
        >
          <Card className="w-full max-w-md bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900 text-red-600">Delete Lead</CardTitle>
              <CardDescription className="text-sm text-gray-500">
                This action cannot be undone. The lead and all associated data will be permanently deleted.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-medium text-red-900 mb-2">Lead Information:</p>
                <div className="text-sm text-red-800 space-y-1">
                  <p><strong>Name:</strong> {lead.name}</p>
                  <p><strong>Phone:</strong> {lead.phone}</p>
                  <p><strong>City:</strong> {lead.city}</p>
                  <p><strong>Status:</strong> {leadStatusLabel(lead.status)}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => {
                    deleteLeadMutation.mutate();
                  }}
                  disabled={deleteLeadMutation.isPending}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {deleteLeadMutation.isPending ? 'Deleting...' : 'Delete Lead'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleteLeadMutation.isPending}
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

export default function LeadDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <LeadDetailContent />
    </Suspense>
  );
}

