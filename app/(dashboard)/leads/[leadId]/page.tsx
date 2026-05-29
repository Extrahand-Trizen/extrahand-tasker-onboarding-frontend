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
  Phone, Mail, MapPin, MapPinned, Landmark, Home, Briefcase, Calendar, User, Tag,
  MessageSquare, Clock, CheckCircle, XCircle,
  ArrowLeft, Edit, Trash2, RefreshCw, UserCheck, Award
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, Suspense, type ComponentType, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { SkillsSection } from '@/components/leads/SkillsSection';
import {
  GooglePlaceAutocomplete,
  type CitySelectionMeta,
} from '@/components/leads/GooglePlaceAutocomplete';
import { PRIMARY_CATEGORY_OPTIONS, leadStatusLabel, categoryDisplay } from '@/lib/leadLabels';

const OTHER_GATED_COMMUNITY_VALUE = '__other__';
const NO_GATED_COMMUNITY_VALUE = '__none__';

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

const leadDetailCardClass = 'border-gray-200 bg-white shadow-sm overflow-hidden';
const leadDetailCardHeaderClass = 'border-b border-gray-100 px-3 py-2 space-y-0';
const leadDetailCardContentClass = 'p-3';

function DetailRow({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start gap-2 py-0.5', className)}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <span className="text-xs text-gray-500">{label}: </span>
        <span className="text-sm text-gray-900 break-words">{value}</span>
      </div>
    </div>
  );
}

function InfoGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

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
    <Card className={leadDetailCardClass}>
      <CardHeader className={leadDetailCardHeaderClass}>
        <CardTitle className="text-sm font-semibold text-gray-900">Platform status</CardTitle>
      </CardHeader>
      <CardContent className={cn(leadDetailCardContentClass, 'space-y-2')}>
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
    <Card className={leadDetailCardClass}>
      <CardHeader className={leadDetailCardHeaderClass}>
        <CardTitle className="text-sm font-semibold text-gray-900">Verified skill certificates</CardTitle>
      </CardHeader>
      <CardContent className={cn(leadDetailCardContentClass, 'space-y-2')}>
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
  const currentUserId = user?.userId || (user as any)?.uid;
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
  const [editCitySelection, setEditCitySelection] = useState<CitySelectionMeta | null>(null);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    email: string;
    city: string;
    state: string;
    locality: string;
    address: string;
    pincode: string;
    isGatedCommunity: boolean;
    gatedCommunityName: string;
    primaryCategory: string;
    secondaryCategory: string;
    source: LeadSource | '';
    sourceDetails: string;
  }>({
    name: '',
    email: '',
    city: '',
    state: '',
    locality: '',
    address: '',
    pincode: '',
    isGatedCommunity: false,
    gatedCommunityName: '',
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
  const gatedCommunityNamesQuery = useQuery({
    queryKey: ['gated-community-names'],
    queryFn: () => caosApi.getGatedCommunityNames(),
    staleTime: 5 * 60 * 1000,
  });

  const lead = leadData?.data;
  const gatedCommunityOptions = Array.from(
    new Set(
      (gatedCommunityNamesQuery.data?.data || [])
        .map((name) => name.trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
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
  const canEditPicked = !lead?.pickedBy || lead.pickedBy === currentUserId;
  const requiresClaimToWorkLead = isOnboarder || isQualifier;
  const hasClaimedLead = !!lead?.pickedBy && lead.pickedBy === currentUserId;
  const mustClaimBeforeStageChange =
    requiresClaimToWorkLead && !!lead && !hasClaimedLead;

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
        locality: lead.locality || '',
        address: lead.address || '',
        pincode: (lead as any).pincode || '',
        isGatedCommunity: !!lead.isGatedCommunity || !!lead.gatedCommunityName,
        gatedCommunityName: lead.gatedCommunityName || '',
        primaryCategory: lead.primaryCategory || (lead as any).primarySkill || '',
        secondaryCategory: lead.secondaryCategory || (lead as any).secondarySkill || '',
        source: lead.source || '',
        sourceDetails: lead.sourceDetails || '',
      });
      setEditCitySelection(
        lead.city
          ? {
              cityName: lead.city,
              stateName: lead.state || undefined,
              placeId: '',
            }
          : null,
      );
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

      if (mustClaimBeforeStageChange) {
        toast.error('Please claim this lead before changing its stage.');
        throw new Error('Lead must be claimed first');
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

  const pickLeadMutation = useMutation({
    mutationFn: () => caosApi.pickLead(leadId),
    onSuccess: () => {
      toast.success('Lead claimed successfully');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['all-leads'] });
      queryClient.invalidateQueries({ queryKey: ['my-picks'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to claim lead');
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
        locality: data.locality.trim() || null,
        address: data.address.trim() || null,
        pincode: data.pincode.trim() || null,
        isGatedCommunity: data.isGatedCommunity,
        gatedCommunityName: data.isGatedCommunity ? data.gatedCommunityName.trim() || null : null,
        primaryCategory: data.primaryCategory.trim() || null,
        primarySkill: data.primaryCategory.trim() || null,
        secondaryCategory: data.secondaryCategory.trim() || null,
        secondarySkill: data.secondaryCategory.trim() || null,
        source: data.source || null,
        sourceDetails: data.sourceDetails.trim() || null,
      };
      return caosApi.updateLead(leadId, updateData);
    },
    onSuccess: () => {
      toast.success('Lead updated successfully');
      setShowEditModal(false);
      setEditCitySelection(null);
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['gated-community-names'] });
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
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="inline-block h-9 w-9 animate-spin rounded-full border-2 border-amber-500 border-r-transparent" />
          <p className="mt-4 text-sm font-medium text-gray-700">Loading helper details...</p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Helper not found</p>
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
    <div className="space-y-3 pb-4">
      {/* Header */}
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          {fromVerification ? (
            <Link href="/leads/verification">
              <Button variant="ghost" size="sm" className="-ml-2 text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Verification Queue
              </Button>
            </Link>
          ) : (
            <Link href="/leads">
              <Button variant="ghost" size="sm" className="-ml-2 shrink-0 text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          )}
          <div className="min-w-0 sm:border-l sm:border-gray-100 sm:pl-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="text-lg font-semibold text-gray-900">{lead.name}</h1>
              <Badge className={cn('shrink-0 text-xs', statusColors[lead.status])}>
                {leadStatusLabel(lead.status)}
              </Badge>
            </div>
            <p className="font-mono text-[11px] text-gray-500">{lead.leadId}</p>
            {lead.pickedBy && (
              <p className="text-[11px] text-amber-700">
                Claimed by {lead.pickedByName || lead.pickedBy}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 lg:justify-end">
          {/* Edit Lead: qualifier can edit only own leads; onboarder/admin can edit all */}
          {canUpdateLead && canEditPicked && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditModal(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Lead
            </Button>
          )}
          {canUpdateLead && !canEditPicked && (
            <Button variant="outline" size="sm" disabled>
              <Edit className="h-4 w-4 mr-2" />
              Locked
            </Button>
          )}
          {/* ✅ Delete Lead button - visible only to lead_access_manager and only for non-bulk-upload leads */}
          {canDeleteLead && !isBulkUpload && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Lead
            </Button>
          )}
            {/* ✅ Only qualifier team can move stages */}
            {canMoveStage && canEditPicked && (
              <Button
                variant="outline"
                size="sm"
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
            {(isQualifier || isOnboarder) && lead && !lead.pickedBy && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => pickLeadMutation.mutate()}
                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                disabled={pickLeadMutation.isPending}
              >
                {pickLeadMutation.isPending ? 'Claiming...' : 'Claim Lead'}
              </Button>
            )}
            {lead?.pickedBy && !canEditPicked && (
              <Button variant="outline" size="sm" disabled>
                Claimed by {lead.pickedByName || lead.pickedBy}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNoteModal(true)}
              disabled={!canEditPicked}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Add Note
            </Button>
        </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {/* Basic Information */}
        <Card className={leadDetailCardClass}>
          <CardHeader className={leadDetailCardHeaderClass}>
            <CardTitle className="text-sm font-semibold text-gray-900">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className={leadDetailCardContentClass}>
            <InfoGroup title="Contact">
              <DetailRow icon={User} label="Name" value={lead.name} />
              <DetailRow icon={Phone} label="Phone" value={lead.phone || '—'} />
              {lead.landline ? (
                <DetailRow icon={Phone} label="Landline" value={lead.landline} />
              ) : null}
              {lead.email ? (
                <DetailRow icon={Mail} label="Email" value={lead.email} />
              ) : null}
            </InfoGroup>
            <div className="mt-2 border-t border-gray-100 pt-2">
              <InfoGroup title="Location">
                <DetailRow icon={MapPin} label="City" value={lead.city || '—'} />
                <DetailRow icon={MapPinned} label="Locality" value={lead.locality || '—'} />
                <DetailRow icon={Landmark} label="State" value={lead.state || '—'} />
                <DetailRow icon={Home} label="Local Area" value={lead.address || '—'} />
              </InfoGroup>
            </div>
          </CardContent>
        </Card>

        {/* Status & Stage */}
        <Card className={leadDetailCardClass}>
          <CardHeader className={leadDetailCardHeaderClass}>
            <CardTitle className="text-sm font-semibold text-gray-900">Onboarding Stage</CardTitle>
          </CardHeader>
          <CardContent className={cn(leadDetailCardContentClass, 'space-y-0.5')}>
            <DetailRow
              icon={Briefcase}
              label="Status"
              value={
                <Badge className={cn('text-xs', statusColors[lead.status])}>
                  {leadStatusLabel(lead.status)}
                </Badge>
              }
            />
            <DetailRow
              icon={Tag}
              label="Category"
              value={categoryDisplay(
                lead.primaryCategory || (lead as any).primarySkill,
                lead.secondaryCategory || (lead as any).secondarySkill,
              )}
            />
            <DetailRow icon={User} label="Source" value={<span className="capitalize">{lead.source || '—'}</span>} />
            {lead.sourceDetails ? (
              <DetailRow icon={MessageSquare} label="Source Details" value={lead.sourceDetails} />
            ) : null}
            <DetailRow icon={User} label="Added By" value={lead.addedByName || lead.addedBy} />
            {lead.pickedBy ? (
              <DetailRow icon={UserCheck} label="Claimed By" value={lead.pickedByName || lead.pickedBy} />
            ) : null}
            <DetailRow
              icon={Calendar}
              label="Created"
              value={new Date(lead.createdAt).toLocaleString()}
            />
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

      {/* Status History / Timeline — includes bulk-upload leads after stage moves */}
      <Card className={leadDetailCardClass}>
        <CardHeader className="border-b border-gray-100 bg-gray-50/50 pb-3">
          <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            Timeline
          </CardTitle>
          {isBulkUpload && (
            <CardDescription className="text-xs text-gray-500">
              Bulk-uploaded lead — shows who created the lead and each stage change.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-5">
          {!(lead.statusHistory?.length) ? (
            <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-4 py-8 text-center text-sm text-gray-500">
              No stage history recorded yet.
            </p>
          ) : (
            <div className="relative space-y-0 pl-1">
              {[...lead.statusHistory]
                .sort(
                  (a, b) =>
                    new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
                )
                .map((history, idx, arr) => (
                  <div
                    key={`${history.status}-${history.changedAt}-${idx}`}
                    className="relative flex gap-4 pb-6 last:pb-0"
                  >
                    {idx < arr.length - 1 ? (
                      <span
                        className="absolute left-[15px] top-8 bottom-0 w-px bg-gray-200"
                        aria-hidden
                      />
                    ) : null}
                    <span className="relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white ring-2 ring-gray-100">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    </span>
                    <div className="min-w-0 flex-1 rounded-lg border border-gray-100 bg-gray-50/40 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={statusColors[history.status]}>
                          {leadStatusLabel(history.status)}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {new Date(history.changedAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-gray-600">
                        by {history.changedByName || history.changedBy || 'Unknown'}
                      </p>
                      {history.notes ? (
                        <p className="mt-2 text-sm text-gray-700 border-t border-gray-100 pt-2">
                          {history.notes}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skills Section */}
      <SkillsSection lead={lead} leadId={leadId} />

      {/* Internal Notes */}
      <Card className={leadDetailCardClass}>
        <CardHeader className={leadDetailCardHeaderClass}>
          <CardTitle className="text-sm font-semibold text-gray-900">Internal Notes</CardTitle>
        </CardHeader>
        <CardContent className={leadDetailCardContentClass}>
          {lead.internalNotes.length === 0 ? (
            <p className="py-3 text-center text-xs text-gray-500">No notes yet.</p>
          ) : (
            <div className="space-y-2">
              {lead.internalNotes.map((note, idx) => (
                <div key={idx} className="rounded border border-gray-100 bg-gray-50/50 px-2.5 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-xs font-medium text-gray-900">
                      {note.addedByName || note.addedBy}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {new Date(note.addedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-700">{note.note}</p>
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
              {(isLeadAccessManager || isOnboarder) && !mustClaimBeforeStageChange && (
                <p className="text-sm text-gray-600 mt-1">
                  You have full access to move leads to any stage.
                </p>
              )}
              {mustClaimBeforeStageChange && (
                <p className="text-sm text-amber-800 mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  Claim this lead first using the <strong>Claim Lead</strong> button before you can change its stage.
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status-select">New Status</Label>
                <Select
                  value={newStatus}
                  disabled={mustClaimBeforeStageChange}
                  onValueChange={(value) => {
                    if (mustClaimBeforeStageChange) {
                      toast.error('Please claim this lead before changing its stage.');
                      return;
                    }
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
                  <SelectTrigger
                    id="status-select"
                    disabled={mustClaimBeforeStageChange}
                    className={mustClaimBeforeStageChange ? 'opacity-60 cursor-not-allowed' : undefined}
                  >
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
                  disabled={mustClaimBeforeStageChange}
                />
              </div>
              {showReasonFields && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="status-reason-code">Reason</Label>
                    <Select
                      value={statusReasonCode || '__none__'}
                      disabled={mustClaimBeforeStageChange}
                      onValueChange={(value) => setStatusReasonCode(value === '__none__' ? '' : value)}
                    >
                      <SelectTrigger id="status-reason-code" disabled={mustClaimBeforeStageChange}>
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
                    disabled={mustClaimBeforeStageChange}
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
                    disabled={mustClaimBeforeStageChange}
                  />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => {
                    if (mustClaimBeforeStageChange) {
                      toast.error('Please claim this lead before changing its stage.');
                      return;
                    }
                    updateStatusMutation.mutate({
                      status: newStatus,
                      notes: statusNotes,
                      statusReasonCode,
                      callbackAt,
                      expectedOnboardingAt,
                    });
                  }}
                  disabled={updateStatusMutation.isPending || mustClaimBeforeStageChange}
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
              setEditCitySelection(null);
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
                <GooglePlaceAutocomplete
                  id="edit-city"
                  label="City"
                  mode="city"
                  value={editFormData.city}
                  onValueChange={(value) => {
                    if (!value.trim()) {
                      setEditCitySelection(null);
                      setEditFormData((prev) => ({ ...prev, city: '', state: '', locality: '' }));
                    } else if (editCitySelection && value.trim() !== editCitySelection.cityName) {
                      setEditCitySelection(null);
                      setEditFormData((prev) => ({ ...prev, city: value, state: '', locality: '' }));
                    } else {
                      setEditFormData((prev) => ({ ...prev, city: value }));
                    }
                  }}
                  onCitySelected={(meta) => {
                    setEditCitySelection(meta);
                    setEditFormData((prev) => ({
                      ...prev,
                      city: meta.cityName,
                      state: meta.stateName || '',
                      locality: '',
                    }));
                  }}
                  onClear={() => {
                    setEditCitySelection(null);
                    setEditFormData((prev) => ({ ...prev, city: '', state: '', locality: '' }));
                  }}
                  helperText="Select city name, for example: Hyderabad."
                />

                <GooglePlaceAutocomplete
                  id="edit-locality"
                  label="Locality"
                  mode="locality"
                  value={editFormData.locality}
                  onValueChange={(value) =>
                    setEditFormData((prev) => ({ ...prev, locality: value }))
                  }
                  citySelection={editCitySelection}
                  onClear={() => setEditFormData((prev) => ({ ...prev, locality: '' }))}
                  helperText="Select locality name, for example: Madhapur."
                />

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="edit-address">Local Area</Label>
                  <Input
                    id="edit-address"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    placeholder="Street, landmark, or area details"
                  />
                  <p className="text-xs text-gray-500">Full address or area details (optional)</p>
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
                  <Select
                    value={editFormData.primaryCategory || undefined}
                    onValueChange={(value) => setEditFormData({ ...editFormData, primaryCategory: value })}
                  >
                    <SelectTrigger id="edit-primary-category">
                      <SelectValue placeholder="Select primary category" />
                    </SelectTrigger>
                    <SelectContent>
                      {editFormData.primaryCategory &&
                        !PRIMARY_CATEGORY_OPTIONS.some((category) => category.value === editFormData.primaryCategory) && (
                          <SelectItem value={editFormData.primaryCategory}>{editFormData.primaryCategory}</SelectItem>
                        )}
                      {PRIMARY_CATEGORY_OPTIONS.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="edit-gated-community">Gated Community</Label>
                  <Select
                    value={
                      editFormData.isGatedCommunity
                        ? editFormData.gatedCommunityName || OTHER_GATED_COMMUNITY_VALUE
                        : NO_GATED_COMMUNITY_VALUE
                    }
                    onValueChange={(value) => {
                      if (value === NO_GATED_COMMUNITY_VALUE) {
                        setEditFormData({ ...editFormData, isGatedCommunity: false, gatedCommunityName: '' });
                      } else if (value === OTHER_GATED_COMMUNITY_VALUE) {
                        setEditFormData({ ...editFormData, isGatedCommunity: true, gatedCommunityName: '' });
                      } else {
                        setEditFormData({ ...editFormData, isGatedCommunity: true, gatedCommunityName: value });
                      }
                    }}
                  >
                    <SelectTrigger id="edit-gated-community">
                      <SelectValue placeholder="Select gated community" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_GATED_COMMUNITY_VALUE}>Not a gated community</SelectItem>
                      {gatedCommunityOptions.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                      {editFormData.gatedCommunityName &&
                        !gatedCommunityOptions.includes(editFormData.gatedCommunityName) && (
                          <SelectItem value={editFormData.gatedCommunityName}>
                            {editFormData.gatedCommunityName}
                          </SelectItem>
                        )}
                      <SelectItem value={OTHER_GATED_COMMUNITY_VALUE}>Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editFormData.isGatedCommunity &&
                  (!editFormData.gatedCommunityName || !gatedCommunityOptions.includes(editFormData.gatedCommunityName)) && (
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="edit-gated-community-name">Gated Community Name</Label>
                      <Input
                        id="edit-gated-community-name"
                        value={editFormData.gatedCommunityName}
                        onChange={(e) => setEditFormData({ ...editFormData, gatedCommunityName: e.target.value })}
                        placeholder="Enter gated community name"
                      />
                    </div>
                  )}
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
                    if (editFormData.isGatedCommunity && !editFormData.gatedCommunityName.trim()) {
                      toast.error('Gated community name is required');
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
                  onClick={() => {
                    setShowEditModal(false);
                    setEditCitySelection(null);
                  }}
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

