'use client';

import { useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { caosBulkApi } from '@/lib/api/caos-bulk';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Upload, Download, FileText, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function BulkLeadImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [primaryCategory, setPrimaryCategory] = useState<string>('');
  const [primaryCategoryOther, setPrimaryCategoryOther] = useState<string>('');
  const [secondaryCategory, setSecondaryCategory] = useState<string>('');
  const [secondaryCategoryOther, setSecondaryCategoryOther] = useState<string>('');
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const importingRef = useRef(false);
  const queryClient = useQueryClient();

  // Load backend preview with validation and duplicate checking
  const loadBackendPreview = async (
    selectedFile: File,
    primary?: string,
    secondary?: string
  ) => {
    setPreviewLoading(true);
    setPreviewError(null);
    
    try {
      const resolvedPrimary = primary === 'other' ? primaryCategoryOther : primary;
      const resolvedSecondary = secondary === 'other' ? secondaryCategoryOther : secondary;

      const preview = await caosBulkApi.previewBulkImportLeads(
        selectedFile,
        resolvedPrimary || primaryCategory,
        resolvedSecondary || secondaryCategory
      );
      
      setPreviewData(preview.data);
      
      // Show warnings for duplicates or errors
      const { summary } = preview.data;
      if (summary.invalid > 0 || summary.duplicatesInFile > 0 || summary.duplicatesInDb > 0 || summary.differentCategory > 0) {
        const warnings = [];
        if (summary.invalid > 0) warnings.push(`${summary.invalid} rows with errors`);
        if (summary.duplicatesInFile > 0) warnings.push(`${summary.duplicatesInFile} repeated entries in file`);
        if (summary.duplicatesInDb > 0) warnings.push(`${summary.duplicatesInDb} already exist`);
        if (summary.differentCategory > 0) warnings.push(`${summary.differentCategory} already exist with different category`);
        
        toast.warning(`Preview completed: ${warnings.join(', ')}`);
      } else {
        toast.success(`Preview loaded: ${summary.valid} rows ready to import`);
      }
    } catch (error: any) {
      setPreviewError(error.message || 'Failed to load preview');
      toast.error('Failed to load preview: ' + (error.message || 'Unknown error'));
    } finally {
      setPreviewLoading(false);
    }
  };

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
        setPreviewData(null);
        setPreviewError(null);

        await loadBackendPreview(selected, primaryCategory || undefined, secondaryCategory || undefined);
      }
    },
  });

  // Reload preview when category filters change
  useEffect(() => {
    if (file) {
      loadBackendPreview(file, primaryCategory, secondaryCategory || undefined);
    }
  }, [file, primaryCategory, primaryCategoryOther, secondaryCategory, secondaryCategoryOther]);

  const downloadTemplateMutation = useMutation({
    mutationFn: () => {
      const resolvedPrimary = primaryCategory === 'other' ? primaryCategoryOther : primaryCategory;
      const resolvedSecondary = secondaryCategory === 'other' ? secondaryCategoryOther : secondaryCategory;
      return caosBulkApi.downloadTemplate(resolvedPrimary || undefined, resolvedSecondary || undefined);
    },
    onSuccess: (blob) => {
      const resolvedPrimary = primaryCategory === 'other' ? primaryCategoryOther : primaryCategory;
      const resolvedSecondary = secondaryCategory === 'other' ? secondaryCategoryOther : secondaryCategory;
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resolvedSecondary
        ? `helper-import-${resolvedPrimary}-${resolvedSecondary.replace(/\s+/g, '-')}-template.csv`
        : `helper-import-${resolvedPrimary}-template.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Template downloaded');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to download template');
    },
  });

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
      'Kitchen Cleaning',
      'Sofa / Upholstery Cleaning'
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
      'Lock Repair',
      'Inverter / UPS Setup',
      'Curtain / Rod Fitting'
    ],
    moving: [
      'Food Delivery',
      'Package Delivery',
      'Moving & Packing',
      'Courier Services',
      'Furniture Moving',
      'Local Transport',
      'Intercity Transport',
      'Grocery Pickup',
      'Document Delivery',
      'Loading / Unloading'
    ],
    gardening: [
      'Lawn Mowing',
      'Garden Maintenance',
      'Tree Trimming',
      'Planting',
      'Landscaping',
      'Pest Control',
      'Irrigation Setup',
      'Plant Care',
      'Garden Cleanup'
    ],
    business: [
      'Data Entry',
      'Virtual Assistant',
      'Accounting',
      'Legal Services',
      'Consulting',
      'Business Setup',
      'Documentation',
      'GST Filing',
      'Income Tax Filing',
      'Payroll Support',
      'Bookkeeping'
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
      'App Development',
      'Laptop Repair',
      'Desktop Setup',
      'Wi-Fi / Router Setup'
    ],
    tutoring: [
      'Math Tutor',
      'English Tutor',
      'Science Tutor',
      'Music Lessons',
      'Yoga Classes',
      'Fitness Training',
      'Language Classes',
      'Exam Preparation',
      'Spoken English',
      'Computer Basics'
    ],
    photography: [
      'Event Photography',
      'Portrait Photography',
      'Product Photography',
      'Wedding Photography',
      'Video Shooting',
      'Photo Editing',
      'Drone Photography',
      'Video Recording'
    ],
    beauty: [
      'Hair Styling',
      'Makeup',
      'Massage',
      'Salon at Home',
      'Spa Services',
      'Haircut',
      'Facial',
      'Manicure/Pedicure',
      'Head / Neck Massage',
      'Therapy Session',
      'Nail Services'
    ],
    'pet-care': [
      'Pet Grooming',
      'Pet Walking',
      'Pet Sitting',
      'Pet Training',
      'Veterinary Assistance',
      'Pet Boarding',
      'Vet Visit Assistance'
    ],
    events: [
      'Event Planning',
      'Catering',
      'Decoration',
      'DJ Services',
      'Photography/Videography',
      'Event Management',
      'Party Planning',
      'DJ / Music Setup',
      'Catering Support'
    ],
    'water-tanker': [
      'Residential Water Tankers',
      'Commercial / Construction Tankers',
      'Emergency Water Supply',
      'Water Can Delivery',
      'Tank Refilling'
    ],
    'ac-repair-service': [
      'AC Service',
      'AC Repair',
      'AC Installation',
      'Gas Refill',
      'AC Not Cooling'
    ],
    'security-services': [
      'Residential Guard',
      'Night Patrol',
      'Event Security',
      'Gate Watchman'
    ],
    'senior-care': [
      'Companionship',
      'Daily Assistance',
      'Medication Reminders',
      'Hospital Visit Support'
    ],
    'driver-chauffeur': [
      'Personal Driver',
      'Outstation Trip Driver',
      'Pickup & Drop',
      'Temporary Driver'
    ],
    'cooking-home-chef': [
      'Daily Meal Cooking',
      'Party Cooking',
      'Regional Cuisine',
      'Meal Prep'
    ],
    'laundry-ironing': [
      'Clothes Washing',
      'Ironing',
      'Dry Cleaning Pickup',
      'Bulk Laundry'
    ],
    other: [
      'Custom Service',
      'Other'
    ]
  };

  const availableSecondaryCategories = primaryCategory 
    ? secondaryCategoriesMap[primaryCategory] || []
    : [];

  const uploadMutation = useMutation({
    mutationFn: (data: { file: File; primaryCategory?: string; secondaryCategory?: string }) => {
      const resolvedPrimary = data.primaryCategory === 'other' ? primaryCategoryOther : data.primaryCategory;
      const resolvedSecondary = data.secondaryCategory === 'other' ? secondaryCategoryOther : data.secondaryCategory;
      return caosBulkApi.bulkImportLeads(data.file, undefined, resolvedPrimary, resolvedSecondary);
    },
    onSuccess: (response) => {
      toast.success(
        `Import completed! ${response.data.successCount} helpers imported, ${response.data.failedCount} failed`
      );
      setFile(null);
      setPrimaryCategory('');
      setPrimaryCategoryOther('');
      setSecondaryCategory('');
      setSecondaryCategoryOther('');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['import-history'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Import failed');
    },
  });

  const handleUpload = () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    if (primaryCategory === 'other' && !primaryCategoryOther.trim()) {
      toast.error('Please specify the primary category');
      return;
    }
    if (secondaryCategory === 'other' && !secondaryCategoryOther.trim()) {
      toast.error('Please specify the secondary category');
      return;
    }

    // Check if there are leads with different categories
    const differentCategoryLeads = previewData?.rows?.filter((row: any) => row.isDifferentCategory) || [];
    
    if (differentCategoryLeads.length > 0) {
      // Show confirmation modal
      setShowConfirmModal(true);
    } else {
      // Proceed directly with import
      proceedWithImport();
    }
  };

  const proceedWithImport = () => {
    if (!file) return;
    if (importingRef.current) return;
    importingRef.current = true;
    setShowConfirmModal(false);
    uploadMutation.mutate({
      file,
      primaryCategory: primaryCategory || undefined,
      secondaryCategory: secondaryCategory || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Bulk Import Leads</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Upload CSV/Excel file to import multiple unverified leads
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Optional category defaults */}
          <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
            <p className="text-sm font-semibold text-blue-900 mb-3">
              Step 1: Select Categories
            </p>
            <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bulk-primary-category">Primary Category (optional)</Label>
              <Select
                value={primaryCategory}
                onValueChange={(value) => {
                  setPrimaryCategory(value);
                  setPrimaryCategoryOther('');
                  setSecondaryCategory(''); // Reset secondary when primary changes
                  setSecondaryCategoryOther('');
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
                  <SelectItem value="ac-repair-service">AC Repair & Service</SelectItem>
                  <SelectItem value="security-services">Security Services</SelectItem>
                  <SelectItem value="senior-care">Senior Care / Elder Care</SelectItem>
                  <SelectItem value="driver-chauffeur">Driver / Chauffeur Services</SelectItem>
                  <SelectItem value="cooking-home-chef">Cooking / Home Chef</SelectItem>
                  <SelectItem value="laundry-ironing">Laundry & Ironing</SelectItem>
                  <SelectItem value="other">Other (Specify Below)</SelectItem>
                </SelectContent>
              </Select>
              {primaryCategory === 'other' && (
                <Input
                  className="mt-2"
                  placeholder="Enter custom primary category"
                  value={primaryCategoryOther}
                  onChange={(e) => setPrimaryCategoryOther(e.target.value)}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-secondary-category">
                Secondary Category
              </Label>
              {primaryCategory && availableSecondaryCategories.length > 0 ? (
                <div className="space-y-2">
                  <Select
                    value={secondaryCategory || (primaryCategory === 'water-tanker' ? '__general__' : undefined)}
                    onValueChange={(v) => {
                      setSecondaryCategory(v === '__general__' ? '' : v);
                      if (v !== 'other') setSecondaryCategoryOther('');
                    }}
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
                      <SelectItem value="other">Other (Specify Below)</SelectItem>
                    </SelectContent>
                  </Select>
                  {secondaryCategory === 'other' && (
                    <Input
                      placeholder="Enter custom secondary category"
                      value={secondaryCategoryOther}
                      onChange={(e) => setSecondaryCategoryOther(e.target.value)}
                    />
                  )}
                </div>
              ) : primaryCategory ? (
                <Input
                  placeholder="Enter secondary category"
                  value={secondaryCategory}
                  onChange={(e) => setSecondaryCategory(e.target.value)}
                />
              ) : (
                <Select disabled>
                  <SelectTrigger id="bulk-secondary-category">
                    <SelectValue placeholder="Select primary category first" />
                  </SelectTrigger>
                </Select>
              )}
            </div>
            </div>
          </div>

          {/* Download Template - Step 2 */}
          <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
            <p className="text-sm font-semibold text-gray-900 mb-3">
              Step 2: Download Template
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">Download CSV Template</p>
                  <p className="text-xs text-gray-500">
                    {(primaryCategory || secondaryCategory)
                      ? (secondaryCategory === 'other' ? secondaryCategoryOther || 'custom' : secondaryCategory)
                        ? `Template for ${primaryCategory === 'other' ? primaryCategoryOther || 'custom' : primaryCategory} - ${secondaryCategory === 'other' ? secondaryCategoryOther || 'custom' : secondaryCategory}`
                        : primaryCategory
                          ? `Template for ${primaryCategory === 'other' ? primaryCategoryOther || 'custom' : primaryCategory}`
                          : 'Template with category columns'
                      : 'Template with category columns'}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadTemplateMutation.mutate()}
                disabled={downloadTemplateMutation.isPending}
              >
                {downloadTemplateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download Template
              </Button>
            </div>
            {(primaryCategory || secondaryCategory) && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-600">
                  The template will be pre-configured for <strong>{primaryCategory === 'other' ? primaryCategoryOther || 'custom' : primaryCategory || "all categories"}</strong>
                  {secondaryCategory ? <> - <strong>{secondaryCategory === 'other' ? secondaryCategoryOther || 'custom' : secondaryCategory}</strong></> : ''}.
                  You don't need to include category columns in your CSV/Excel file.
                </p>
                <p className="text-xs text-gray-600">
                  Optional columns: City/Area, State, Address, Pincode, Experience Level, Preferred Time Slot, Source.
                </p>
              </div>
            )}
          </div>

          {/* File Upload - Step 3 */}
          <div className="p-4 border border-gray-200 rounded-lg">
            <p className="text-sm font-semibold text-gray-900 mb-3">
              Step 3: Upload CSV/Excel File
            </p>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-300 hover:border-amber-300 hover:bg-amber-50/30'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              {file ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <p className="text-sm font-medium">{file.name}</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
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
                    Remove
                  </Button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 mb-1">
                    Drag and drop a CSV/Excel file here, or click to select
                  </p>
                  <p className="text-xs text-gray-500">
                    Supports CSV, XLS, XLSX files (max 10MB)
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
                    <span className="text-green-600">✓ Ready to import: {previewData.summary.valid + (previewData.summary.differentCategory || 0)}</span>
                    {/* <span className="text-red-600">✗ Has errors: {previewData.summary.invalid}</span> */}
                    {previewData.summary.differentCategory > 0 && (
                      <span className="text-orange-600">⚠ Already exists with different category: {previewData.summary.differentCategory}</span>
                    )}
                    {previewData.summary.duplicatesInFile > 0 && (
                      <span className="text-orange-600">⚠ Repeated in uploaded file: {previewData.summary.duplicatesInFile}</span>
                    )}
                    {previewData.summary.duplicatesInDb > 0 && (
                      <span className="text-red-600">⚠ Already exists on the platform with this category: {previewData.summary.duplicatesInDb}</span>
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
                        <th className="px-2 py-2 text-left font-semibold border-b">Landline</th>
                        <th className="px-2 py-2 text-left font-semibold border-b">City</th>
                        <th className="px-2 py-2 text-left font-semibold border-b">Category</th>
                        <th className="px-2 py-2 text-left font-semibold border-b">Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.rows.map((row: any, idx: number) => (
                        <tr key={idx} className={`
                          ${row.status === 'valid' ? 'bg-green-50' : row.status === 'warning' ? 'bg-orange-50' : 'bg-red-50'}
                          ${row.isDuplicateInFile || row.isDuplicateInDb ? 'bg-orange-50' : ''}
                        `}>
                          <td className="px-2 py-2 border-b">{row.rowNumber}</td>
                          <td className="px-2 py-2 border-b">
                            {row.status === 'valid' ? (
                              <span className="text-green-600 font-semibold">✓</span>
                            ) : row.status === 'warning' ? (
                              <span className="text-orange-600 font-semibold">⚠</span>
                            ) : (
                              <span className="text-red-600 font-semibold">✗</span>
                            )}
                          </td>
                          <td className="px-2 py-2 border-b whitespace-nowrap">{row.name}</td>
                          <td className="px-2 py-2 border-b whitespace-nowrap">{row.phone || '-'}</td>
                          <td className="px-2 py-2 border-b whitespace-nowrap">{row.landline || '-'}</td>
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
                            ) : row.isDifferentCategory && row.existingPrimaryCategory ? (
                              <div className="text-xs text-orange-600">
                                ⚠ Already exists with: {row.existingPrimaryCategory} - {row.existingSecondaryCategory || 'N/A'}
                              </div>
                            ) : (
                              <span className="text-green-600">-</span>
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
                      <strong>Note:</strong> {previewData.summary.invalid} rows have errors and will be skipped during import.
                      {previewData.summary.valid} rows are ready to import.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={!file || uploadMutation.isPending}
              className="w-full mt-4"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : previewData ? (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {previewData.summary.valid + (previewData.summary.differentCategory || 0)} Leads Ready to Import
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Leads
                </>
              )}
            </Button>

            {/* Results */}
            {uploadMutation.isSuccess && uploadMutation.data && (
              <div className="p-4 border rounded-lg bg-green-50 mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="font-medium text-green-900">Import Completed</p>
                </div>
                <div className="text-sm text-green-800 space-y-1">
                  <p>Total Rows: {uploadMutation.data.data.totalRows}</p>
                  <p>Success: {uploadMutation.data.data.successCount}</p>
                  {uploadMutation.data.data.failedCount > 0 && (
                    <p className="text-red-600">
                      Failed: {uploadMutation.data.data.failedCount}
                    </p>
                  )}
                </div>
                {uploadMutation.data.data.errors.length > 0 && (
                  <div className="mt-3 p-3 bg-red-50 rounded border border-red-200">
                    <p className="text-xs font-medium text-red-900 mb-2">Errors:</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {uploadMutation.data.data.errors.slice(0, 5).map((error, idx) => (
                        <p key={idx} className="text-xs text-red-700">
                          Row {error.row}: {error.error}
                        </p>
                      ))}
                      {uploadMutation.data.data.errors.length > 5 && (
                        <p className="text-xs text-red-600">
                          ... and {uploadMutation.data.data.errors.length - 5} more errors
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal for Different Category Leads */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Leads Already Exist with Different Categories
            </DialogTitle>
            <DialogDescription>
              The following leads already exist on the platform with different categories. They will still be imported with the new category.
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[400px] overflow-y-auto">
            <div className="space-y-2">
              {previewData?.rows
                ?.filter((row: any) => row.isDifferentCategory)
                .map((row: any, idx: number) => (
                  <div key={idx} className="p-3 border border-orange-200 rounded-lg bg-orange-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">
                          {row.name} ({row.phone})
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          <span className="font-medium">New Category:</span>{' '}
                          {row.primaryCategory === 'water-tanker' && !row.secondaryCategory
                            ? 'Water & Tanker Services (General)'
                            : `${row.primaryCategory}${row.secondaryCategory ? ` - ${row.secondaryCategory}` : ''}`}
                        </p>
                        <p className="text-xs text-orange-700 mt-1">
                          <span className="font-medium">Existing Category:</span> {row.existingPrimaryCategory || 'N/A'} - {row.existingSecondaryCategory || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmModal(false)}
            >
              Close
            </Button>
            <Button
              onClick={proceedWithImport}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
