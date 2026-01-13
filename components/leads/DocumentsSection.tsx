'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { caosApi, type Lead } from '@/lib/api/caos';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Upload, CheckCircle, XCircle, Clock, Trash2, Eye, FileText, Loader2 } from 'lucide-react';

const ADMIN_SERVICE_URL = process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL;
if (!ADMIN_SERVICE_URL) {
  throw new Error('NEXT_PUBLIC_ADMIN_SERVICE_URL environment variable is required');
}

const documentTypeLabels: Record<Lead['documents'][0]['type'], string> = {
  aadhaar: 'Aadhaar',
  pan: 'PAN',
  address_proof: 'Address Proof',
  skill_certificate: 'Skill Certificate',
  photo: 'Photo',
  other: 'Other',
};

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  verified: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const statusIcons = {
  pending: Clock,
  verified: CheckCircle,
  rejected: XCircle,
};

interface DocumentsSectionProps {
  lead: Lead;
  leadId: string;
}

export function DocumentsSection({ lead, leadId }: DocumentsSectionProps) {
  const queryClient = useQueryClient();
  const { role } = useJWTAuth();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedDocIndex, setSelectedDocIndex] = useState<number | null>(null);
  const [documentType, setDocumentType] = useState<Lead['documents'][0]['type']>('aadhaar');
  const [documentUrl, setDocumentUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<'verified' | 'rejected'>('verified');
  const [rejectionReason, setRejectionReason] = useState('');
  const [entryMode, setEntryMode] = useState<'upload' | 'manual'>('upload');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [addressDetails, setAddressDetails] = useState('');
  // ✅ Exact details for verification (unmasked) - entered by operations/admin
  const [exactAadhaarNumber, setExactAadhaarNumber] = useState('');
  const [exactPANNumber, setExactPANNumber] = useState('');
  const [exactAddressDetails, setExactAddressDetails] = useState('');
  
  // ✅ Aadhaar verification flow state
  const [showAadhaarVerificationModal, setShowAadhaarVerificationModal] = useState(false);
  const [aadhaarVerificationStep, setAadhaarVerificationStep] = useState<'initiate' | 'verify'>('initiate');
  const [aadhaarRefId, setAadhaarRefId] = useState('');
  const [aadhaarOTP, setAadhaarOTP] = useState('');
  const [aadhaarTestOtp, setAadhaarTestOtp] = useState('');
  const [aadhaarForVerification, setAadhaarForVerification] = useState('');
  
  // ✅ PAN verification flow state
  const [showPANVerificationModal, setShowPANVerificationModal] = useState(false);
  const [panForVerification, setPanForVerification] = useState('');

  // ✅ Role-based permissions
  // Marketing: Cannot upload documents (view only)
  // Operations/Admin: Can upload and verify documents
  // Support: View only
  const canUpload = ['operations', 'admin'].includes(role || '');
  const canVerify = ['operations', 'admin'].includes(role || '');
  // Allow same roles that can upload to also delete their documents
  const canDelete = ['operations', 'admin'].includes(role || '');

  const uploadMutation = useMutation({
    mutationFn: async (data: { 
      type: Lead['documents'][0]['type']; 
      file?: File; 
      url?: string;
      aadhaarNumber?: string;
      panNumber?: string;
      addressDetails?: string;
    }) => {
      let url = data.url;

      // If file provided, upload via admin-service proxy
      if (data.file) {
        setUploading(true);
        const form = new FormData();
        form.append('file', data.file);
        form.append('docType', data.type);
        form.append('leadId', leadId);

        const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;

        const res = await fetch(`${ADMIN_SERVICE_URL}/api/v1/onboarding/uploads/document`, {
          method: 'POST',
          headers: {
            ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
          },
          body: form,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Upload failed');
        }
        const dataRes = await res.json();
        url = dataRes?.data?.url;
        if (!url) throw new Error('No URL returned from upload');
      }

      // Call API with manual entry data if provided
      await caosApi.uploadDocument(leadId, data.type, url, {
        aadhaarNumber: data.aadhaarNumber,
        panNumber: data.panNumber,
        addressDetails: data.addressDetails,
      });
    },
    onSuccess: () => {
      // ✅ All document uploads require manual verification
      toast.success('Document uploaded successfully. It will be reviewed by the verification team.');
      setShowUploadModal(false);
      setDocumentUrl('');
      setFile(null);
      setAadhaarNumber('');
      setPanNumber('');
      setAddressDetails('');
      setEntryMode('upload');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to upload document');
    },
    onSettled: () => setUploading(false),
  });

  const verifyMutation = useMutation({
    mutationFn: (data: { 
      status: 'verified' | 'rejected'; 
      rejectionReason?: string;
      exactAadhaarNumber?: string;
      exactPANNumber?: string;
      exactAddressDetails?: string;
    }) =>
      caosApi.verifyDocument(
        leadId, 
        selectedDocIndex!, 
        data.status, 
        data.rejectionReason,
        {
          exactAadhaarNumber: data.exactAadhaarNumber,
          exactPANNumber: data.exactPANNumber,
          exactAddressDetails: data.exactAddressDetails
        }
      ),
    onSuccess: () => {
      toast.success(`Document ${verifyStatus} successfully`);
      setShowVerifyModal(false);
      setSelectedDocIndex(null);
      setRejectionReason('');
      setExactAadhaarNumber('');
      setExactPANNumber('');
      setExactAddressDetails('');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['verification-queue'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to verify document');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (index: number) => caosApi.deleteDocument(leadId, index),
    onSuccess: () => {
      toast.success('Document deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete document');
    },
  });

  // ✅ Aadhaar verification mutations
  const initiateAadhaarMutation = useMutation({
    mutationFn: ({ documentIndex, aadhaarNumber }: { documentIndex: number; aadhaarNumber: string }) =>
      caosApi.initiateAadhaarVerification(leadId, documentIndex, aadhaarNumber),
    onSuccess: (data) => {
      setAadhaarRefId(data.data.refId);
      setAadhaarTestOtp(data.data.testOtp || '');
      setAadhaarVerificationStep('verify');
      toast.success(data.data.message || 'OTP sent successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to initiate Aadhaar verification');
    },
  });

  const verifyAadhaarOTPMutation = useMutation({
    mutationFn: ({ documentIndex, refId, otp, aadhaarNumber }: { documentIndex: number; refId: string; otp: string; aadhaarNumber: string }) =>
      caosApi.verifyAadhaarOTP(leadId, documentIndex, refId, otp, aadhaarNumber),
    onSuccess: (data) => {
      toast.success(data.message || 'Aadhaar verified successfully');
      setShowAadhaarVerificationModal(false);
      setAadhaarForVerification('');
      setAadhaarRefId('');
      setAadhaarOTP('');
      setAadhaarTestOtp('');
      setAadhaarVerificationStep('initiate');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['verification-queue'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to verify Aadhaar OTP');
    },
  });

  // ✅ PAN verification mutation
  const verifyPANMutation = useMutation({
    mutationFn: ({ documentIndex, panNumber }: { documentIndex: number; panNumber: string }) =>
      caosApi.verifyPAN(leadId, documentIndex, panNumber),
    onSuccess: (data) => {
      toast.success(data.message || 'PAN verified successfully');
      setShowPANVerificationModal(false);
      setPanForVerification('');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['verification-queue'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to verify PAN');
    },
  });

  const handleVerify = (index: number) => {
    const doc = lead.documents[index];
    
    // ✅ For Aadhaar and PAN, use API verification flow
    if (doc.type === 'aadhaar') {
      setSelectedDocIndex(index);
      setAadhaarForVerification('');
      setAadhaarRefId('');
      setAadhaarOTP('');
      setAadhaarTestOtp('');
      setAadhaarVerificationStep('initiate');
      setShowAadhaarVerificationModal(true);
    } else if (doc.type === 'pan') {
      setSelectedDocIndex(index);
      setPanForVerification('');
      setShowPANVerificationModal(true);
    } else {
      // ✅ For other documents (address_proof, etc.), use manual verification
      setSelectedDocIndex(index);
      setVerifyStatus('verified');
      setRejectionReason('');
      setExactAadhaarNumber('');
      setExactPANNumber('');
      setExactAddressDetails('');
      setShowVerifyModal(true);
    }
  };

  const handleDelete = (index: number) => {
    if (confirm('Are you sure you want to delete this document?')) {
      deleteMutation.mutate(index);
    }
  };

  const isBulkUpload = lead.creationMethod === 'bulk_upload';

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Documents</CardTitle>
          {!isBulkUpload && canUpload && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUploadModal(true)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {lead.documents.length === 0 ? (
            <p className="text-sm text-gray-600">No documents uploaded yet</p>
          ) : (
            <div className="space-y-3">
              {lead.documents.map((doc, index) => {
                const StatusIcon = statusIcons[doc.status];
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{documentTypeLabels[doc.type]}</p>
                          <Badge className={statusColors[doc.status]}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {doc.status}
                          </Badge>
                        </div>
                        {/* Show masked numbers if manually entered */}
                        {doc.type === 'aadhaar' && doc.aadhaarNumber && (
                          <p className="text-xs text-gray-600 mt-1">
                            Number: {doc.aadhaarNumber}
                          </p>
                        )}
                        {doc.type === 'pan' && doc.panNumber && (
                          <p className="text-xs text-gray-600 mt-1">
                            PAN: {doc.panNumber}
                          </p>
                        )}
                        {doc.type === 'address_proof' && doc.addressDetails && (
                          <p className="text-xs text-gray-600 mt-1">
                            Address: {doc.addressDetails}
                          </p>
                        )}
                        {doc.uploadedAt && (
                          <p className="text-xs text-gray-500 mt-1">
                            Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                        )}
                        {doc.verifiedAt && (
                          <p className="text-xs text-gray-500">
                            Verified: {new Date(doc.verifiedAt).toLocaleDateString()}
                          </p>
                        )}
                        {doc.rejectionReason && (
                          <p className="text-xs text-red-600 mt-1">
                            Reason: {doc.rejectionReason}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(doc.url, '_blank')}
                          title="View document"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      {/* ✅ Show verify button only for pending documents and if user can verify */}
                      {!isBulkUpload && doc.status === 'pending' && canVerify && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerify(index)}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Verify
                        </Button>
                      )}
                      {/* ✅ Show delete button only if user has permission */}
                      {!isBulkUpload && canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(index)}
                          title="Delete document"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      {showUploadModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowUploadModal(false);
              setDocumentUrl('');
              setFile(null);
            }
          }}
        >
          <Card className="w-full max-w-md bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Upload Document</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="doc-type-select">Document Type</Label>
                <Select
                  value={documentType}
                  onValueChange={(value) => {
                    setDocumentType(value as Lead['documents'][0]['type']);
                    setEntryMode('upload');
                    setAadhaarNumber('');
                    setPanNumber('');
                    setAddressDetails('');
                  }}
                >
                  <SelectTrigger id="doc-type-select">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aadhaar">Aadhaar</SelectItem>
                    <SelectItem value="pan">PAN</SelectItem>
                    <SelectItem value="address_proof">Address Proof</SelectItem>
                    <SelectItem value="skill_certificate">Skill Certificate</SelectItem>
                    <SelectItem value="photo">Photo</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Entry Mode Toggle (only for Aadhaar, PAN, and Address Proof) */}
              {(documentType === 'aadhaar' || documentType === 'pan' || documentType === 'address_proof') && (
                <div className="space-y-2">
                  <Label>Entry Method</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={entryMode === 'upload' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setEntryMode('upload');
                        setAadhaarNumber('');
                        setPanNumber('');
                        setAddressDetails('');
                      }}
                      className="flex-1"
                    >
                      Upload Image
                    </Button>
                    <Button
                      type="button"
                      variant={entryMode === 'manual' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setEntryMode('manual');
                        setFile(null);
                        setDocumentUrl('');
                        setAadhaarNumber('');
                        setPanNumber('');
                        setAddressDetails('');
                      }}
                      className="flex-1"
                    >
                      Manual Entry
                    </Button>
                  </div>
                </div>
              )}

              {/* Upload Mode */}
              {entryMode === 'upload' && (
                <>
                  <div className="space-y-2">
                    <Label>Upload File (jpg/png/pdf, max 10MB)</Label>
                    <Input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setFile(f);
                          setDocumentUrl('');
                        }
                      }}
                    />
                    {file && (
                      <p className="text-xs text-gray-600">
                        Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="doc-url-input">Or paste a document URL</Label>
                    <Input
                      id="doc-url-input"
                      type="url"
                      value={documentUrl}
                      onChange={(e) => {
                        setDocumentUrl(e.target.value);
                        setFile(null);
                      }}
                      placeholder="https://example.com/document.pdf"
                    />
                  </div>
                </>
              )}

              {/* Manual Entry Mode */}
              {entryMode === 'manual' && (
                <>
                  {documentType === 'aadhaar' && (
                    <div className="space-y-2">
                      <Label htmlFor="aadhaar-input">Aadhaar Number *</Label>
                      <Input
                        id="aadhaar-input"
                        type="text"
                        value={aadhaarNumber}
                        onChange={(e) => {
                          // Allow only digits, format as user types
                          const value = e.target.value.replace(/\D/g, '').slice(0, 12);
                          // Format as XXXX XXXX XXXX
                          const formatted = value.replace(/(\d{4})(?=\d)/g, '$1 ');
                          setAadhaarNumber(formatted);
                        }}
                        placeholder="1234 5678 9012"
                        maxLength={14}
                      />
                      <p className="text-xs text-gray-500">
                        Enter 12-digit Aadhaar number. Only last 4 digits will be stored for compliance.
                      </p>
                    </div>
                  )}

                  {documentType === 'pan' && (
                    <div className="space-y-2">
                      <Label htmlFor="pan-input">PAN Number *</Label>
                      <Input
                        id="pan-input"
                        type="text"
                        value={panNumber}
                        onChange={(e) => {
                          // Allow only alphanumeric, uppercase, max 10 chars
                          const value = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10);
                          setPanNumber(value);
                        }}
                        placeholder="ABCDE1234F"
                        maxLength={10}
                      />
                      <p className="text-xs text-gray-500">
                        Format: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F)
                      </p>
                    </div>
                  )}

                  {documentType === 'address_proof' && (
                    <div className="space-y-2">
                      <Label htmlFor="address-input">Address Details *</Label>
                      <Textarea
                        id="address-input"
                        value={addressDetails}
                        onChange={(e) => setAddressDetails(e.target.value)}
                        placeholder="Enter full address (Street, City, State, Pincode)"
                        rows={4}
                        className="resize-none"
                      />
                      <p className="text-xs text-gray-500">
                        Enter complete address details including street, city, state, and pincode
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Submit Button */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => {
                    if (entryMode === 'upload') {
                      if (!file && !documentUrl.trim()) {
                        toast.error('Please select a file or paste a URL');
                        return;
                      }
                      uploadMutation.mutate({
                        type: documentType,
                        file: file || undefined,
                        url: file ? undefined : documentUrl.trim(),
                      });
                    } else {
                      // Manual entry
                      if (documentType === 'aadhaar') {
                        const cleaned = aadhaarNumber.replace(/\s/g, '');
                        if (cleaned.length !== 12) {
                          toast.error('Aadhaar number must be exactly 12 digits');
                          return;
                        }
                        uploadMutation.mutate({
                          type: documentType,
                          aadhaarNumber: cleaned,
                        });
                      } else if (documentType === 'pan') {
                        if (!panNumber || panNumber.length !== 10) {
                          toast.error('PAN number must be exactly 10 characters');
                          return;
                        }
                        if (!/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(panNumber)) {
                          toast.error('Invalid PAN format. Must be ABCDE1234F');
                          return;
                        }
                        uploadMutation.mutate({
                          type: documentType,
                          panNumber: panNumber,
                        });
                      } else if (documentType === 'address_proof') {
                        if (!addressDetails.trim() || addressDetails.trim().length < 10) {
                          toast.error('Address details must be at least 10 characters long');
                          return;
                        }
                        uploadMutation.mutate({
                          type: documentType,
                          addressDetails: addressDetails.trim(),
                        });
                      }
                    }
                  }}
                  disabled={uploadMutation.isPending || uploading}
                  className="flex-1"
                >
                  {uploadMutation.isPending || uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {entryMode === 'manual' ? 'Saving...' : 'Uploading...'}
                    </>
                  ) : (
                    entryMode === 'manual' ? 'Save' : 'Upload'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUploadModal(false);
                    setDocumentUrl('');
                    setFile(null);
                    setAadhaarNumber('');
                    setPanNumber('');
                    setAddressDetails('');
                    setEntryMode('upload');
                  }}
                  disabled={uploadMutation.isPending || uploading}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Verify Modal */}
      {showVerifyModal && selectedDocIndex !== null && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowVerifyModal(false);
              setSelectedDocIndex(null);
              setRejectionReason('');
              setExactAadhaarNumber('');
              setExactPANNumber('');
              setExactAddressDetails('');
            }
          }}
        >
          <Card className="w-full max-w-md bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Verify Document</CardTitle>
              <CardDescription className="text-sm text-gray-600">
                {verifyStatus === 'verified' && selectedDocIndex !== null && 
                 ['aadhaar', 'pan', 'address_proof'].includes(lead.documents[selectedDocIndex]?.type || '') && (
                  <span className="text-amber-600 font-medium">
                    ⚠️ Manual entry of exact details is mandatory for verification
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verify-status-select">Status</Label>
                <Select
                  value={verifyStatus}
                  onValueChange={(value) => {
                    setVerifyStatus(value as 'verified' | 'rejected');
                    // Clear exact details if switching to rejected
                    if (value === 'rejected') {
                      setExactAadhaarNumber('');
                      setExactPANNumber('');
                      setExactAddressDetails('');
                    }
                  }}
                >
                  <SelectTrigger id="verify-status-select">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* ✅ Exact details input when verifying - MANDATORY */}
              {verifyStatus === 'verified' && selectedDocIndex !== null && (
                <>
                  {/* Mandatory notice for Aadhaar, PAN, and Address Proof */}
                  {['aadhaar', 'pan', 'address_proof'].includes(lead.documents[selectedDocIndex]?.type || '') && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm text-amber-800 font-medium">
                        📝 Manual Entry Required
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        You must enter the exact details manually. This information will be stored securely and used during account creation.
                      </p>
                    </div>
                  )}
                  
                  {lead.documents[selectedDocIndex]?.type === 'aadhaar' && (
                    <div className="space-y-2">
                      <Label htmlFor="exact-aadhaar" className="text-gray-900 font-semibold">
                        Exact Aadhaar Number <span className="text-red-600">*</span> (Required)
                      </Label>
                      <Input
                        id="exact-aadhaar"
                        type="text"
                        value={exactAadhaarNumber}
                        onChange={(e) => {
                          // Allow only digits, max 12
                          const value = e.target.value.replace(/\D/g, '').slice(0, 12);
                          setExactAadhaarNumber(value);
                        }}
                        placeholder="1234 5678 9012"
                        maxLength={12}
                      />
                      <p className="text-xs text-gray-600 font-medium">
                        ⚠️ <span className="text-red-600">Mandatory:</span> Enter full 12-digit Aadhaar number (will be stored securely for account creation)
                      </p>
                    </div>
                  )}
                  
                  {lead.documents[selectedDocIndex]?.type === 'pan' && (
                    <div className="space-y-2">
                      <Label htmlFor="exact-pan" className="text-gray-900 font-semibold">
                        Exact PAN Number <span className="text-red-600">*</span> (Required)
                      </Label>
                      <Input
                        id="exact-pan"
                        type="text"
                        value={exactPANNumber}
                        onChange={(e) => {
                          // Allow only alphanumeric, uppercase, max 10 chars
                          const value = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10);
                          setExactPANNumber(value);
                        }}
                        placeholder="ABCDE1234F"
                        maxLength={10}
                      />
                      <p className="text-xs text-gray-600 font-medium">
                        ⚠️ <span className="text-red-600">Mandatory:</span> Enter full 10-character PAN number (will be stored securely for account creation)
                      </p>
                    </div>
                  )}
                  
                  {lead.documents[selectedDocIndex]?.type === 'address_proof' && (
                    <div className="space-y-2">
                      <Label htmlFor="exact-address" className="text-gray-900 font-semibold">
                        Exact Address Details <span className="text-red-600">*</span> (Required)
                      </Label>
                      <Textarea
                        id="exact-address"
                        value={exactAddressDetails}
                        onChange={(e) => setExactAddressDetails(e.target.value)}
                        placeholder="Enter complete address (Street, City, State, Pincode)"
                        rows={4}
                        className="resize-none"
                      />
                      <p className="text-xs text-gray-600 font-medium">
                        ⚠️ <span className="text-red-600">Mandatory:</span> Enter complete address details (will be stored securely for account creation)
                      </p>
                    </div>
                  )}
                </>
              )}
              
              {verifyStatus === 'rejected' && (
                <div className="space-y-2">
                  <Label htmlFor="rejection-reason">Rejection Reason *</Label>
                  <Textarea
                    id="rejection-reason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter reason for rejection..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => {
                    // ✅ Validate exact details if verifying
                    if (verifyStatus === 'verified' && selectedDocIndex !== null) {
                      const doc = lead.documents[selectedDocIndex];
                      if (doc.type === 'aadhaar' && !exactAadhaarNumber.trim()) {
                        toast.error('Please enter exact Aadhaar number');
                        return;
                      }
                      if (doc.type === 'pan' && !exactPANNumber.trim()) {
                        toast.error('Please enter exact PAN number');
                        return;
                      }
                      if (doc.type === 'address_proof' && !exactAddressDetails.trim()) {
                        toast.error('Please enter exact address details');
                        return;
                      }
                    }
                    
                    verifyMutation.mutate({
                      status: verifyStatus,
                      rejectionReason: verifyStatus === 'rejected' ? rejectionReason : undefined,
                      exactAadhaarNumber: verifyStatus === 'verified' ? exactAadhaarNumber : undefined,
                      exactPANNumber: verifyStatus === 'verified' ? exactPANNumber : undefined,
                      exactAddressDetails: verifyStatus === 'verified' ? exactAddressDetails : undefined,
                    });
                  }}
                  disabled={
                    verifyMutation.isPending || 
                    (verifyStatus === 'rejected' && !rejectionReason.trim()) ||
                    (verifyStatus === 'verified' && selectedDocIndex !== null && (
                      (lead.documents[selectedDocIndex]?.type === 'aadhaar' && !exactAadhaarNumber.trim()) ||
                      (lead.documents[selectedDocIndex]?.type === 'pan' && !exactPANNumber.trim()) ||
                      (lead.documents[selectedDocIndex]?.type === 'address_proof' && !exactAddressDetails.trim())
                    ))
                  }
                  className="flex-1"
                >
                  {verifyMutation.isPending ? 'Verifying...' : 'Submit'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowVerifyModal(false);
                    setSelectedDocIndex(null);
                    setRejectionReason('');
                    setExactAadhaarNumber('');
                    setExactPANNumber('');
                    setExactAddressDetails('');
                  }}
                  disabled={verifyMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ✅ Aadhaar Verification Modal */}
      {showAadhaarVerificationModal && selectedDocIndex !== null && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAadhaarVerificationModal(false);
              setAadhaarForVerification('');
              setAadhaarRefId('');
              setAadhaarOTP('');
              setAadhaarTestOtp('');
              setAadhaarVerificationStep('initiate');
            }
          }}
        >
          <Card className="w-full max-w-md bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Verify Aadhaar via Cashfree</CardTitle>
              <CardDescription>
                Enter the Aadhaar number from the document and verify via OTP
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {aadhaarVerificationStep === 'initiate' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="aadhaar-verify-input">Aadhaar Number *</Label>
                    <Input
                      id="aadhaar-verify-input"
                      type="text"
                      value={aadhaarForVerification}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 12);
                        setAadhaarForVerification(value);
                      }}
                      placeholder="1234 5678 9012"
                      maxLength={12}
                    />
                    <p className="text-xs text-gray-500">
                      Enter the 12-digit Aadhaar number from the document
                    </p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => {
                        if (!aadhaarForVerification || aadhaarForVerification.length !== 12) {
                          toast.error('Please enter a valid 12-digit Aadhaar number');
                          return;
                        }
                        initiateAadhaarMutation.mutate({
                          documentIndex: selectedDocIndex,
                          aadhaarNumber: aadhaarForVerification
                        });
                      }}
                      disabled={initiateAadhaarMutation.isPending || !aadhaarForVerification || aadhaarForVerification.length !== 12}
                      className="flex-1"
                    >
                      {initiateAadhaarMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending OTP...
                        </>
                      ) : (
                        'Send OTP'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAadhaarVerificationModal(false);
                        setAadhaarForVerification('');
                        setAadhaarRefId('');
                        setAadhaarOTP('');
                        setAadhaarTestOtp('');
                        setAadhaarVerificationStep('initiate');
                      }}
                      disabled={initiateAadhaarMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {aadhaarTestOtp && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800 font-medium">
                        🧪 Sandbox Mode
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Test OTP: <span className="font-mono font-bold">{aadhaarTestOtp}</span>
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="aadhaar-otp-input">OTP *</Label>
                    <Input
                      id="aadhaar-otp-input"
                      type="text"
                      value={aadhaarOTP}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setAadhaarOTP(value);
                      }}
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                    />
                    <p className="text-xs text-gray-500">
                      Enter the OTP sent to the user's mobile number
                    </p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => {
                        if (!aadhaarOTP || aadhaarOTP.length !== 6) {
                          toast.error('Please enter a valid 6-digit OTP');
                          return;
                        }
                        verifyAadhaarOTPMutation.mutate({
                          documentIndex: selectedDocIndex,
                          refId: aadhaarRefId,
                          otp: aadhaarOTP,
                          aadhaarNumber: aadhaarForVerification
                        });
                      }}
                      disabled={verifyAadhaarOTPMutation.isPending || !aadhaarOTP || aadhaarOTP.length !== 6}
                      className="flex-1"
                    >
                      {verifyAadhaarOTPMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        'Verify OTP'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAadhaarVerificationStep('initiate');
                        setAadhaarOTP('');
                        setAadhaarRefId('');
                        setAadhaarTestOtp('');
                      }}
                      disabled={verifyAadhaarOTPMutation.isPending}
                    >
                      Back
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ✅ PAN Verification Modal */}
      {showPANVerificationModal && selectedDocIndex !== null && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPANVerificationModal(false);
              setPanForVerification('');
            }
          }}
        >
          <Card className="w-full max-w-md bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Verify PAN via Cashfree</CardTitle>
              <CardDescription>
                Enter the PAN number from the document to verify
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pan-verify-input">PAN Number *</Label>
                <Input
                  id="pan-verify-input"
                  type="text"
                  value={panForVerification}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10);
                    setPanForVerification(value);
                  }}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                />
                <p className="text-xs text-gray-500">
                  Format: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F)
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => {
                    if (!panForVerification || panForVerification.length !== 10) {
                      toast.error('Please enter a valid 10-character PAN number');
                      return;
                    }
                    if (!/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(panForVerification)) {
                      toast.error('Invalid PAN format. Must be ABCDE1234F');
                      return;
                    }
                    verifyPANMutation.mutate({
                      documentIndex: selectedDocIndex,
                      panNumber: panForVerification
                    });
                  }}
                  disabled={verifyPANMutation.isPending || !panForVerification || panForVerification.length !== 10}
                  className="flex-1"
                >
                  {verifyPANMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify PAN'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPANVerificationModal(false);
                    setPanForVerification('');
                  }}
                  disabled={verifyPANMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

