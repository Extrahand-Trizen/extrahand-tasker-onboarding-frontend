'use client';

import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, Download, UserPlus, Edit, Trash2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { adminApi } from '@/lib/api/admin';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { toast } from 'sonner';
// import Papa from 'papaparse';

export function BulkUploadForm() {
  const { role, loading: authLoading } = useJWTAuth();
  const [operationType, setOperationType] = useState<'create' | 'update' | 'delete'>('create');
  
  // ✅ Role-based permissions
  // Qualifier team can only create taskers, not update or delete
  const canCreate = true; // All roles can create
  const canUpdate = role === 'onboarder' || role === 'lead_access_manager';
  const canDelete = role === 'onboarder' || role === 'lead_access_manager';
  
  // Reset to 'create' if qualifier team tries to access update/delete
  useEffect(() => {
    if (!authLoading && role === 'qualifier' && operationType !== 'create') {
      setOperationType('create');
      toast.error('Qualifier team can only create taskers. Update and delete onboarder are restricted to onboarder and admin teams.');
    }
  }, [role, authLoading, operationType]);
  const [file, setFile] = useState<File | null>(null);
  const [primaryCategory, setPrimaryCategory] = useState<string>('');
  const [secondaryCategory, setSecondaryCategory] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sendEmails, setSendEmails] = useState<boolean>(true);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const selected = acceptedFiles[0];
        setFile(selected);
        setResult(null);
        setPreviewData(null);
        setPreviewError(null);

        if (operationType === 'create') {
          await loadBackendPreview(selected, primaryCategory || undefined, secondaryCategory || undefined);
        } else {
          // For update/delete, can preview without categories
          await loadBackendPreview(selected);
        }
      }
    },
  });

  // Load backend preview with validation and duplicate checking
  const loadBackendPreview = async (
    selectedFile: File,
    primary?: string,
    secondary?: string
  ) => {
    setPreviewLoading(true);
    setPreviewError(null);
    
    try {
      const preview = await adminApi.previewBulkUpload(
        selectedFile,
        primary || primaryCategory,
        secondary || secondaryCategory
      );
      
      setPreviewData(preview.data);
      
      // Show warnings for duplicates or errors
      const { summary } = preview.data;
      if (summary.invalid > 0 || summary.duplicatesInFile > 0 || summary.duplicatesInDb > 0) {
        const warnings = [];
        if (summary.invalid > 0) warnings.push(`${summary.invalid} invalid rows`);
        if (summary.duplicatesInFile > 0) warnings.push(`${summary.duplicatesInFile} duplicates in file`);
        if (summary.duplicatesInDb > 0) warnings.push(`${summary.duplicatesInDb} already exist in database`);
        
        toast.warning(`Preview completed: ${warnings.join(', ')}`);
      } else {
        toast.success(`Preview loaded: ${summary.valid} valid rows`);
      }
    } catch (error: any) {
      setPreviewError(error.message || 'Failed to load preview');
      toast.error('Failed to load preview: ' + (error.message || 'Unknown error'));
    } finally {
      setPreviewLoading(false);
    }
  };

  // Reload preview when category filters change
  useEffect(() => {
    if (file && operationType === 'create') {
      loadBackendPreview(file, primaryCategory, secondaryCategory || undefined);
    }
  }, [file, operationType, primaryCategory, secondaryCategory]);

  // Secondary categories mapping based on primary category
  const secondaryCategoriesMap: Record<string, string[]> = {
    cleaning: [
      'House Cleaning',
      'Deep Cleaning',
      'Office Cleaning',
      'Car Cleaning',
      'Move-in/Move-out Cleaning',
      'Window Cleaning',
      'Carpet Cleaning',
      'Bathroom Cleaning',
      'Kitchen Cleaning'
    ],
    handyperson: [
      'Plumbing',
      'Electrical',
      'Carpentry',
      'Painting',
      'AC Repair',
      'Appliance Repair',
      'Furniture Assembly',
      'Wall Mounting',
      'Door/Window Repair',
      'Lock Repair'
    ],
    moving: [
      'Food Delivery',
      'Package Delivery',
      'Moving & Packing',
      'Courier Services',
      'Furniture Moving',
      'Local Transport',
      'Intercity Transport'
    ],
    gardening: [
      'Lawn Mowing',
      'Garden Maintenance',
      'Tree Trimming',
      'Planting',
      'Landscaping',
      'Pest Control',
      'Irrigation Setup'
    ],
    business: [
      'Data Entry',
      'Virtual Assistant',
      'Accounting',
      'Legal Services',
      'Consulting',
      'Business Setup',
      'Documentation'
    ],
    marketing: [
      'Graphic Design',
      'Social Media Management',
      'Content Writing',
      'SEO Services',
      'Digital Marketing',
      'Branding',
      'Video Editing'
    ],
    tech: [
      'Computer Repair',
      'Phone Repair',
      'Software Help',
      'Website Design',
      'IT Support',
      'Network Setup',
      'Data Recovery',
      'App Development'
    ],
    tutoring: [
      'Math Tutor',
      'English Tutor',
      'Science Tutor',
      'Music Lessons',
      'Yoga Classes',
      'Fitness Training',
      'Language Classes',
      'Exam Preparation'
    ],
    photography: [
      'Event Photography',
      'Portrait Photography',
      'Product Photography',
      'Wedding Photography',
      'Video Shooting',
      'Photo Editing',
      'Drone Photography'
    ],
    beauty: [
      'Hair Styling',
      'Makeup',
      'Massage',
      'Salon at Home',
      'Spa Services',
      'Haircut',
      'Facial',
      'Manicure/Pedicure'
    ],
    'pet-care': [
      'Pet Grooming',
      'Pet Walking',
      'Pet Sitting',
      'Pet Training',
      'Veterinary Assistance',
      'Pet Boarding'
    ],
    events: [
      'Event Planning',
      'Catering',
      'Decoration',
      'DJ Services',
      'Photography/Videography',
      'Event Management',
      'Party Planning'
    ],
    'water-tanker': [
      'Residential Water Tankers',
      'Commercial / Construction Tankers',
      'Emergency Water Supply'
    ],
    other: [
      'Custom Service',
      'Other'
    ]
  };

  const availableSecondaryCategories = primaryCategory 
    ? secondaryCategoriesMap[primaryCategory] || []
    : [];

  const handleDownloadTemplate = async () => {
    try {
      const blob = await adminApi.downloadTemplate(
        operationType, 
        operationType === 'create' ? (primaryCategory || undefined) : undefined,
        operationType === 'create' ? (secondaryCategory || undefined) : undefined
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = operationType === 'create' && primaryCategory
        ? secondaryCategory
          ? `tasker-${operationType}-${primaryCategory}-${secondaryCategory.replace(/\s+/g, '-')}-template.csv`
          : `tasker-${operationType}-${primaryCategory}-template.csv`
        : `tasker-${operationType}-template.csv`;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch (error: any) {
      toast.error(error.message || 'Failed to download template');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    // ✅ Validate permissions before upload
    if (operationType === 'update' && !canUpdate) {
      toast.error('You do not have permission to update taskers. Only onboarder and admin teams can update.');
      return;
    }

    if (operationType === 'delete' && !canDelete) {
      toast.error('You do not have permission to delete taskers. Only onboarder and admin teams can delete.');
      return;
    }

    setUploading(true);
    setProgress(0);
    setResult(null);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      const response = await adminApi.bulkUploadUsers(
        file,
        operationType === 'create' ? (primaryCategory || undefined) : undefined,
        operationType === 'create' ? (secondaryCategory || undefined) : undefined,
        sendEmails
      );
      
      clearInterval(progressInterval);
      setProgress(100);
      setResult(response.data);
      
      toast.success(`Upload completed! ${response.data.success} onboarder successful`);
      
      setTimeout(() => {
        setFile(null);
        setPrimaryCategory('');
        setSecondaryCategory('');
        setProgress(0);
      }, 2000);
    } catch (error: any) {
      toast.error(error.message || 'Upload failed');
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Operation Type Selector */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Bulk Upload Leads</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Upload CSV to create taskers that will appear in the taskers list with status "Account Created"
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`grid gap-4 ${canUpdate && canDelete ? 'grid-cols-3' : 'grid-cols-1'}`}>
            <button
              onClick={() => setOperationType('create')}
              className={`
                p-4 border-2 rounded-lg text-center transition-all duration-200
                ${operationType === 'create' 
                  ? 'border-amber-500 bg-amber-50 shadow-sm' 
                  : 'border-gray-200 hover:border-gray-300'}
              `}
            >
              <UserPlus className={`w-8 h-8 mx-auto mb-2 ${operationType === 'create' ? 'text-amber-600' : 'text-gray-400'}`} />
              <h3 className="font-semibold text-gray-900">Create Leads</h3>
              <p className="text-sm text-gray-600">Add new leads to the system</p>
            </button>

            {/* ✅ Update operation - Only for onboarder and admin */}
            {canUpdate && (
              <button
                onClick={() => {
                  if (!canUpdate) {
                    toast.error('You do not have permission to update taskers. Only onboarder and admin teams can update.');
                    return;
                  }
                  setOperationType('update');
                }}
                className={`
                  p-4 border-2 rounded-lg text-center transition-all duration-200
                  ${operationType === 'update' 
                    ? 'border-amber-500 bg-amber-50 shadow-sm' 
                    : 'border-gray-200 hover:border-gray-300'}
                `}
              >
                <Edit className={`w-8 h-8 mx-auto mb-2 ${operationType === 'update' ? 'text-amber-600' : 'text-gray-400'}`} />
                <h3 className="font-semibold text-gray-900">Update Users</h3>
                <p className="text-sm text-gray-600">Update existing profiles</p>
              </button>
            )}

            {/* ✅ Delete operation - Only for onboarder and admin */}
            {canDelete && (
              <button
                onClick={() => {
                  if (!canDelete) {
                    toast.error('You do not have permission to delete taskers. Only onboarder and admin teams can delete.');
                    return;
                  }
                  setOperationType('delete');
                }}
                className={`
                  p-4 border-2 rounded-lg text-center transition-all duration-200
                  ${operationType === 'delete' 
                    ? 'border-red-500 bg-red-50 shadow-sm' 
                    : 'border-gray-200 hover:border-gray-300'}
                `}
              >
                <Trash2 className={`w-8 h-8 mx-auto mb-2 ${operationType === 'delete' ? 'text-red-600' : 'text-gray-400'}`} />
                <h3 className="font-semibold text-gray-900">Delete Users</h3>
                <p className="text-sm text-gray-600">Remove user accounts</p>
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Category Selection - Only for Create operation */}
      {operationType === 'create' && (
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Step 1: Select Categories</CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Select the primary and secondary categories for all taskers in this upload
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bulk-primary-category">Primary Category (optional)</Label>
                <Select
                  value={primaryCategory}
                  onValueChange={(value) => {
                    setPrimaryCategory(value);
                    setSecondaryCategory(''); // Reset secondary when primary changes
                  }}
                >
                  <SelectTrigger id="bulk-primary-category">
                    <SelectValue placeholder="Select primary category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                    <SelectItem value="handyperson">Handyperson</SelectItem>
                    <SelectItem value="moving">Moving & Delivery</SelectItem>
                    <SelectItem value="gardening">Gardening</SelectItem>
                    <SelectItem value="business">Business Services</SelectItem>
                    <SelectItem value="marketing">Marketing & Design</SelectItem>
                    <SelectItem value="tech">Tech Support</SelectItem>
                    <SelectItem value="tutoring">Tutoring</SelectItem>
                    <SelectItem value="photography">Photography</SelectItem>
                    <SelectItem value="beauty">Beauty & Wellness</SelectItem>
                    <SelectItem value="pet-care">Pet Care</SelectItem>
                    <SelectItem value="events">Events & Entertainment</SelectItem>
                    <SelectItem value="water-tanker">Water & Tanker Services</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-secondary-category">
                  Secondary Category
                </Label>
                {primaryCategory && availableSecondaryCategories.length > 0 ? (
                  <Select
                    value={secondaryCategory || (primaryCategory === 'water-tanker' ? '__general__' : undefined)}
                    onValueChange={(v) => setSecondaryCategory(v === '__general__' ? '' : v)}
                  >
                    <SelectTrigger id="bulk-secondary-category">
                      <SelectValue placeholder="Select secondary category" />
                    </SelectTrigger>
                    <SelectContent>
                      {primaryCategory === 'water-tanker' && (
                        <SelectItem value="__general__">General water tanker services</SelectItem>
                      )}
                      {availableSecondaryCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                      {primaryCategory !== 'water-tanker' && (
                        <SelectItem value="other">Other (specify in CSV)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select disabled>
                    <SelectTrigger id="bulk-secondary-category">
                      <SelectValue placeholder="Select primary category first" />
                    </SelectTrigger>
                  </Select>
                )}
              </div>
            </div>
            {(primaryCategory || secondaryCategory) && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  All rows in your CSV will be assigned <strong>{primaryCategory || "all categories"}</strong>
                  {secondaryCategory ? <> - <strong>{secondaryCategory}</strong></> : ''}.
                  You don't need to include category columns in your CSV/Excel file.
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Optional columns: City/Area, State, Address, Pincode, Experience Level, Preferred Time Slot, Source.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* File Upload */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">
                {operationType === 'create' && (primaryCategory && secondaryCategory ? 'Step 2: Download Template' : 'Step 2: Download Template')}
                {operationType === 'update' && 'Upload CSV/Excel to Update Users'}
                {operationType === 'delete' && 'Upload CSV/Excel to Delete Users'}
              </CardTitle>
              <CardDescription className="text-sm text-gray-500">
                {operationType === 'create' && ((primaryCategory || secondaryCategory)
                  ? secondaryCategory
                    ? `Template for ${primaryCategory} - ${secondaryCategory}`
                    : primaryCategory
                      ? `Template for ${primaryCategory}`
                      : 'Template with category columns'
                  : 'Template with category columns')}
                {operationType === 'update' && 'Download template for updating existing users'}
                {operationType === 'delete' && 'Download template for deleting users'}
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              onClick={handleDownloadTemplate}
            >
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email Toggle - Only for create operation */}
          {operationType === 'create' && (
            <div className="flex items-center space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Checkbox
                id="send-emails-toggle"
                checked={sendEmails}
                onCheckedChange={(checked) => setSendEmails(checked === true)}
              />
              <Label 
                htmlFor="send-emails-toggle" 
                className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Send confirmation emails to taskers
              </Label>
            </div>
          )}
          {operationType === 'create' && (
            <p className="text-sm font-semibold text-gray-900 mb-2">Step 3: Upload CSV/Excel File</p>
          )}
          {/* File Dropzone */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors
              ${isDragActive ? 'border-amber-500 bg-amber-50' : 'border-gray-300'}
              ${file ? 'border-green-500 bg-green-50' : ''}
              ${!file && !isDragActive ? 'hover:border-amber-300 hover:bg-amber-50/30' : ''}
            `}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <File className="w-8 h-8 text-green-600" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setPreviewData(null);
                    setPreviewError(null);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div>
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">
                  {isDragActive
                    ? 'Drop the file here'
                    : 'Drag & drop CSV/Excel file here, or click to select'}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Supports .csv, .xlsx, .xls files (max 10MB)
                </p>
              </div>
            )}
          </div>

          {/* Backend Preview with Validation */}
          {previewLoading && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">Loading preview with validation and duplicate checking...</p>
            </div>
          )}

          {previewError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{previewError}</p>
            </div>
          )}

          {previewData && (
            <div className="mt-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 text-sm">Preview with Validation</h3>
                <div className="flex gap-4 text-xs">
                  <span className="text-green-600">✓ Valid: {previewData.summary.valid}</span>
                  <span className="text-red-600">✗ Invalid: {previewData.summary.invalid}</span>
                  {previewData.summary.duplicatesInFile > 0 && (
                    <span className="text-orange-600">⚠ Duplicates in file: {previewData.summary.duplicatesInFile}</span>
                  )}
                  {previewData.summary.duplicatesInDb > 0 && (
                    <span className="text-purple-600">⚠ Already in system: {previewData.summary.duplicatesInDb}</span>
                  )}
                </div>
              </div>

              <div className="overflow-auto max-h-96 border border-gray-200 rounded">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-100 text-gray-700 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold border-b">Row</th>
                      <th className="px-2 py-2 text-left font-semibold border-b">Status</th>
                      <th className="px-2 py-2 text-left font-semibold border-b">Name</th>
                      <th className="px-2 py-2 text-left font-semibold border-b">Phone</th>
                      <th className="px-2 py-2 text-left font-semibold border-b">City</th>
                      <th className="px-2 py-2 text-left font-semibold border-b">Category</th>
                      <th className="px-2 py-2 text-left font-semibold border-b">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row: any, idx: number) => (
                      <tr key={idx} className={`
                        ${row.status === 'valid' ? 'bg-green-50' : 'bg-red-50'}
                        ${row.isDuplicateInFile || row.isDuplicateInDb ? 'bg-orange-50' : ''}
                      `}>
                        <td className="px-2 py-2 border-b">{row.rowNumber}</td>
                        <td className="px-2 py-2 border-b">
                          {row.status === 'valid' ? (
                            <span className="text-green-600 font-semibold">✓</span>
                          ) : (
                            <span className="text-red-600 font-semibold">✗</span>
                          )}
                        </td>
                        <td className="px-2 py-2 border-b whitespace-nowrap">{row.name}</td>
                        <td className="px-2 py-2 border-b whitespace-nowrap">{row.phone || '-'}</td>
                        <td className="px-2 py-2 border-b whitespace-nowrap">{row.city}</td>
                        <td className="px-2 py-2 border-b whitespace-nowrap text-xs">
                          {row.primaryCategory === 'water-tanker' && !row.secondaryCategory
                            ? 'Water & Tanker Services (General)'
                            : `${row.primaryCategory}${row.secondaryCategory ? ` - ${row.secondaryCategory}` : ''}`}
                        </td>
                        <td className="px-2 py-2 border-b">
                          {row.errors.length > 0 ? (
                            <div className="space-y-1">
                              {row.errors.map((error: string, i: number) => (
                                <div key={i} className="text-xs text-red-600">• {error}</div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-green-600">-</span>
                          )}
                          {row.isDuplicateInFile && (
                            <div className="text-xs text-orange-600">⚠ Duplicate in file</div>
                          )}
                          {row.isDuplicateInDb && (
                            <div className="text-xs text-purple-600">⚠ Already in system ({row.duplicateLeadId})</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {previewData.summary.invalid > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800">
                    <strong>Warning:</strong> {previewData.summary.invalid} rows have errors and will be skipped during import.
                    Only {previewData.summary.valid} valid rows will be imported.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Email Toggle - After file upload (only for create operation) */}
          {file && operationType === 'create' && (
            <div className="flex items-center space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Checkbox
                id="send-emails-upload-toggle"
                checked={sendEmails}
                onCheckedChange={(checked) => setSendEmails(checked === true)}
              />
              <Label 
                htmlFor="send-emails-upload-toggle" 
                className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Send confirmation emails to taskers after upload
              </Label>
            </div>
          )}

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full"
          >
            {uploading ? 'Uploading...' : previewData ? `Import ${previewData.summary.valid} Valid Leads` : 'Upload & Process'}
          </Button>

          {/* Results */}
          {result && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-2">
              <h3 className="font-semibold">Upload Results</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-2xl font-bold">{result.success + result.failed}</p>
                </div>
                <div>
                  <p className="text-sm text-green-600">Success</p>
                  <p className="text-2xl font-bold text-green-600">{result.success}</p>
                </div>
                <div>
                  <p className="text-sm text-red-600">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                </div>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Errors:</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {result.errors.slice(0, 10).map((error: any, idx: number) => (
                      <p key={idx} className="text-xs text-red-600">
                        Row {error.row}: {error.error}
                      </p>
                    ))}
                    {result.errors.length > 10 && (
                      <p className="text-xs text-gray-500">
                        ... and {result.errors.length - 10} more errors
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

