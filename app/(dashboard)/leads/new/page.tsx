'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { caosApi, type LeadSource } from '@/lib/api/caos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { PRIMARY_CATEGORY_OPTIONS } from '@/lib/leadLabels';

const OTHER_GATED_COMMUNITY_VALUE = '__other__';

type LeadFormData = {
  name: string;
  phone: string;
  landline: string;
  email: string;
  city?: string;
  address?: string;
  pincode?: string;
  gatedCommunitySelection?: string;
  gatedCommunityOther?: string;
  primaryCategory?:
    | 'cleaning'
    | 'handyperson'
    | 'moving'
    | 'gardening'
    | 'business'
    | 'marketing'
    | 'tech'
    | 'tutoring'
    | 'photography'
    | 'beauty'
    | 'pet-care'
    | 'events'
    | 'water-tanker'
    | 'ac-repair-service'
    | 'security-services'
    | 'senior-care'
    | 'driver-chauffeur'
    | 'cooking-home-chef'
    | 'laundry-ironing'
    | 'auto-electricians'
    | 'av-specialist'
    | 'alteration-services'
    | 'assembly-services'
    | 'bakers-services'
    | 'bicycle-services'
    | 'bricklaying-services'
    | 'decking'
    | 'florist'
    | 'flooring-services'
    | 'draftsman'
    | 'gate-installation'
    | 'home-automation'
    | 'home-theatre-services'
    | 'receptionist-services'
    | 'sharpening-services'
    | 'writing-services'
    | 'admin-office-services'
    | 'interior-architecture'
    | 'building-construction'
    | 'other';
  primaryCategoryOther?: string;
  secondaryCategory?: string;
  secondaryCategoryOther?: string;
  experienceLevel?: 'beginner' | 'intermediate' | 'experienced';
  workingDays?: string;
  preferredTimeSlot?: string;
  source?: LeadSource;
};

const leadSchema = z.object({
  name: z.string().min(2, 'Full Name must be at least 2 characters'),
  phone: z.string().regex(/^\d{10}$/, 'Invalid phone number (must be exactly 10 digits)').optional().or(z.literal('')),
  landline: z.string().regex(/^[0-9]{6,15}$/, 'Invalid landline number (6-15 digits)').optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits').optional().or(z.literal('')),
  gatedCommunitySelection: z.string().optional(),
  gatedCommunityOther: z.string().optional(),
  primaryCategory: z.enum([
    'cleaning',
    'handyperson',
    'moving',
    'gardening',
    'business',
    'marketing',
    'tech',
    'tutoring',
    'photography',
    'beauty',
    'pet-care',
    'events',
    'water-tanker',
    'ac-repair-service',
    'security-services',
    'senior-care',
    'driver-chauffeur',
    'cooking-home-chef',
    'laundry-ironing',
    'auto-electricians',
    'av-specialist',
    'alteration-services',
    'assembly-services',
    'bakers-services',
    'bicycle-services',
    'bricklaying-services',
    'decking',
    'florist',
    'flooring-services',
    'draftsman',
    'gate-installation',
    'home-automation',
    'home-theatre-services',
    'receptionist-services',
    'sharpening-services',
    'writing-services',
    'admin-office-services',
    'interior-architecture',
    'building-construction',
    'other'
  ]).optional(),
  primaryCategoryOther: z.string().optional(),
  secondaryCategory: z.string().default(''),
  secondaryCategoryOther: z.string().optional(),
  experienceLevel: z.enum(['beginner', 'intermediate', 'experienced']).optional(),
  workingDays: z.string().optional(),
  preferredTimeSlot: z.string().optional(),
  source: z.enum(['referral', 'campaign', 'walk-in', 'agent', 'other']).optional(),
})
  .refine(
    (data) => {
      const phone = data.phone?.trim();
      const landline = data.landline?.trim();
      return (phone && phone.length > 0) || (landline && landline.length > 0);
    },
    {
      message: 'At least one contact number (Mobile or Landline) is required',
      path: ['phone'],
    }
  )
  .superRefine((data, ctx) => {
    if (data.gatedCommunitySelection === OTHER_GATED_COMMUNITY_VALUE && !data.gatedCommunityOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please specify the gated community name',
        path: ['gatedCommunityOther']
      });
    }
    if (data.primaryCategory === 'other' && !data.primaryCategoryOther?.trim()) {
      ctx.addIssue({ 
        code: z.ZodIssueCode.custom, 
        message: 'Please specify the primary category', 
        path: ['primaryCategoryOther'] 
      });
    }
    if (data.secondaryCategory === 'other' && !data.secondaryCategoryOther?.trim()) {
      ctx.addIssue({ 
        code: z.ZodIssueCode.custom, 
        message: 'Please specify the secondary category', 
        path: ['secondaryCategoryOther'] 
      });
    }
  });

export default function AddLeadPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);


  const submittingRef = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    trigger,
  } = useForm<LeadFormData>({
    // TS struggles to reconcile Zod's refined schema type with RHF's Resolver generics.
    // @ts-expect-error Resolver type mismatch is safe to ignore here
    resolver: zodResolver(leadSchema),
    defaultValues: {
      source: undefined,
      primaryCategory: undefined,
      secondaryCategory: '',
    },
  });

  const primaryCategoryValue = watch('primaryCategory');
  const secondaryCategoryValue = watch('secondaryCategory');
  const gatedCommunitySelectionValue = watch('gatedCommunitySelection');

  // Fetch existing gated community names for dropdown
  const gatedCommunityNamesQuery = useQuery({
    queryKey: ['gated-community-names'],
    queryFn: () => caosApi.getGatedCommunityNames(),
    staleTime: 5 * 60 * 1000,
  });
  const existingGatedCommunityNames: string[] = gatedCommunityNamesQuery.data?.data || [];
  const gatedCommunityOptions = Array.from(
    new Set(
      existingGatedCommunityNames
        .map((name) => name.trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

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
      'Curtain / Rod Fitting',
      'Rangehood Installation',
      'Oven Fan Repair',
      'Ice Machine Repair',
      'Freezer Installation',
      'Gas Oven Repair & Installation',
      'Fridge Repair & Installation',
      'Dishwasher Not Draining',
      'DishDrawer Installation',
      'Bosch Appliance Repair',
      'Coffee Machine Repair',
      'Cooker Hood Installation'
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
      'Bookkeeping',
      'Xero Training',
      'Pension Advisor',
      'Mortgage Advisor',
      'Financial Reporting',
      'Financial Modelling',
      'Budgeting Help',
      'MYOB Training',
      'Financial Advisor'
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
      'Nail Services',
      'Beard Grooming',
      'Mobile Barber'
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
    'auto-electricians': [],
    'av-specialist': [],
    'alteration-services': [
      'Zipper Repair Services',
      'Wedding Dress Alterations'
    ],
    'assembly-services': [],
    'bakers-services': [
      'Japanese Baker',
      'Keto Bakers',
      'Gluten Free Bakers',
      'Greek Bakers',
      'French Bakers',
      'Custom Birthday Cake',
      'Cake Toppers',
      'Cake Decorators',
      'Artisan Bakers',
      'Custom Celebration Cakes'
    ],
    'bicycle-services': [],
    'bricklaying-services': [],
    'decking': [],
    'florist': [],
    'flooring-services': [],
    'draftsman': [],
    'gate-installation': [],
    'home-automation': [],
    'home-theatre-services': [],
    'receptionist-services': [],
    'sharpening-services': [],
    'writing-services': [
      'Resume Writing',
      'Report Writing'
    ],
    'admin-office-services': [
      'Queuing',
      'eBay Selling Assistance',
      'Research Assistant',
      'HR Services',
      'Personal Assistant',
      'Office Work',
      'Document Filing'
    ],
    'interior-architecture': [
      'Building Designers',
      'Loft Conversion',
      'House Renovation',
      'House Extensions',
      'Architectural Rendering',
      'Floor Planning',
      'Garage Conversion'
    ],
    'building-construction': [
      'Building Construction'
    ]
  };

  // Get secondary categories for selected primary category
  const availableSecondaryCategories = primaryCategoryValue 
    ? secondaryCategoriesMap[primaryCategoryValue] || []
    : [];

  // Check for duplicates when phone or landline changes
  const checkDuplicate = async (value: string, type: 'phone' | 'landline' = 'phone') => {
    if (!value || (type === 'phone' && value.length < 10) || (type === 'landline' && value.length < 6)) {
      return;
    }

    try {
      const result = await caosApi.checkDuplicate(value, type);
      if (result.data.isDuplicate && result.data.existingLead) {
        setDuplicateWarning(
          `Duplicate found: Helper ${result.data.existingLead.leadId} (${result.data.existingLead.status})`
        );
      } else {
        setDuplicateWarning(null);
      }
    } catch {
      // Ignore duplicate check errors
    }
  };

  const createLeadMutation = useMutation<
    Awaited<ReturnType<typeof caosApi.createLead>>,
    Error,
    Parameters<typeof caosApi.createLead>[0]
  >({
    mutationFn: (data: Parameters<typeof caosApi.createLead>[0]) => caosApi.createLead(data),
    onSuccess: (response, variables) => {
      const normalizedGatedCommunityName = variables.gatedCommunityName?.trim();
      if (normalizedGatedCommunityName) {
        queryClient.setQueryData<{ success: boolean; data: string[] } | undefined>(
          ['gated-community-names'],
          (current) => {
            const names = Array.from(
              new Set([...(current?.data || []), normalizedGatedCommunityName])
            ).sort((a, b) => a.localeCompare(b));

            return {
              success: true,
              data: names,
            };
          }
        );
      }
      queryClient.invalidateQueries({ queryKey: ['gated-community-names'] });
      toast.success('Helper created successfully!');
      router.push(`/leads/${response.data.leadId}`);
    },
    onError: (error: Error) => {
      if (error.message.includes('Duplicate')) {
        toast.error('Duplicate helper found. Please check existing helpers.');
      } else {
        toast.error(error.message || 'Failed to create helper');
      }
    },
    onSettled: () => {
      submittingRef.current = false;
    },
  });

  const onSubmit = async (data: LeadFormData) => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    // Final duplicate check
    if (data.phone?.trim()) {
      await checkDuplicate(data.phone.trim(), 'phone');
    }
    if (data.landline?.trim()) {
      await checkDuplicate(data.landline.trim(), 'landline');
    }
    
    if (duplicateWarning) {
      toast.warning('Please resolve duplicate before creating helper');
      submittingRef.current = false;
      return;
    }

    const resolvedPrimaryCategory =
      data.primaryCategory === 'other'
        ? (data.primaryCategoryOther || '').trim()
        : (data.primaryCategory || '').trim();

    const resolvedSecondaryCategory =
      data.secondaryCategory === 'other'
        ? (data.secondaryCategoryOther || '').trim()
        : (data.secondaryCategory || '').trim();

    const normalizedPhone = data.phone?.trim() || '';
    const normalizedLandline = data.landline?.trim() || '';
    const resolvedGatedCommunityName =
      data.gatedCommunitySelection === OTHER_GATED_COMMUNITY_VALUE
        ? (data.gatedCommunityOther || '').trim()
        : (data.gatedCommunitySelection || '').trim();

    const payload: Parameters<typeof caosApi.createLead>[0] = {
      name: data.name.trim(),
      email: data.email?.trim() || undefined,
      phone: normalizedPhone || undefined,
      landline: normalizedLandline || undefined,
      city: data.city?.trim() || undefined,
      address: data.address?.trim() || undefined,
      pincode: data.pincode?.trim() || undefined,
      workingDays: data.workingDays?.trim() || undefined,
      preferredTimeSlot: data.preferredTimeSlot?.trim() || undefined,
      source: data.source || undefined,
      experienceLevel: data.experienceLevel || undefined,
      primaryCategory: resolvedPrimaryCategory || undefined,
      secondaryCategory:
        data.secondaryCategory === '__general__' ? '' : (resolvedSecondaryCategory || ''),
      isGatedCommunity: Boolean(resolvedGatedCommunityName),
      gatedCommunityName: resolvedGatedCommunityName || undefined,
    };

    createLeadMutation.mutate(payload);
  };



  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Add Lead</h1>
        <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm text-gray-500">
          Create a new lead entry
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">Add New Lead</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Enter the basic information to create a new lead in the pipeline
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="John Doe"
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Mobile Number</Label>
                <Input
                  id="phone"
                  {...register('phone')}
                  placeholder="9876543210"
                  maxLength={10}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value) {
                      checkDuplicate(value, 'phone');
                    }
                  }}
                  className={errors.phone ? 'border-red-500' : ''}
                />
                {errors.phone && (
                  <p className="text-sm text-red-600">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="landline">Landline Number (Optional)</Label>
                <Input
                  id="landline"
                  {...register('landline')}
                  placeholder="01123456789"
                  maxLength={15}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value) {
                      checkDuplicate(value, 'landline');
                    }
                  }}
                  className={errors.landline ? 'border-red-500' : ''}
                />
                {errors.landline && (
                  <p className="text-sm text-red-600">{errors.landline.message}</p>
                )}
              </div>
            </div>

            {(errors.phone?.message?.includes('At least one contact number') || 
              (!watch('phone')?.trim() && !watch('landline')?.trim() && (errors.phone || errors.landline))) && (
              <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                At least one contact number (Mobile or Landline) is required
              </div>
            )}

            {duplicateWarning && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{duplicateWarning}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  placeholder="john@example.com"
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  {...register('city')}
                  placeholder="Delhi"
                  className={errors.city ? 'border-red-500' : ''}
                />
                {errors.city && (
                  <p className="text-sm text-red-600">{errors.city.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="address">Local Area</Label>
                <Input
                  id="address"
                  {...register('address')}
                  placeholder="Andheri West"
                  className={errors.address ? 'border-red-500' : ''}
                />
                {errors.address && (
                  <p className="text-sm text-red-600">{errors.address.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode</Label>
                <Input
                  id="pincode"
                  {...register('pincode')}
                  placeholder="400053"
                  maxLength={6}
                  className={errors.pincode ? 'border-red-500' : ''}
                />
                {errors.pincode && (
                  <p className="text-sm text-red-600">{errors.pincode.message}</p>
                )}
              </div>
            </div>

            {/* Gated Community */}
            <div className="space-y-3">
              <Label htmlFor="gatedCommunitySelection">Gated Community</Label>
              <div className="flex gap-2">
                <Select
                  value={gatedCommunitySelectionValue || undefined}
                  onValueChange={(value) => {
                    setValue('gatedCommunitySelection', value, { shouldValidate: true });
                    if (value !== OTHER_GATED_COMMUNITY_VALUE) {
                      setValue('gatedCommunityOther', '', { shouldValidate: false });
                    }
                    void trigger('gatedCommunityOther');
                  }}
                >
                  <SelectTrigger id="gatedCommunitySelection" className="flex-1 bg-white">
                    <SelectValue
                      placeholder={
                        gatedCommunityNamesQuery.isLoading
                          ? 'Loading gated communities...'
                          : 'Select gated community'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {gatedCommunityOptions.map((name) => (
                      <SelectItem
                        key={name}
                        value={name}
                        className="hover:bg-gray-100 cursor-pointer"
                      >
                        {name}
                      </SelectItem>
                    ))}
                    <SelectItem
                      value={OTHER_GATED_COMMUNITY_VALUE}
                      className="hover:bg-gray-100 cursor-pointer"
                    >
                      Other (Specify Below)
                    </SelectItem>
                  </SelectContent>
                </Select>
                {gatedCommunitySelectionValue && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setValue('gatedCommunitySelection', '', { shouldValidate: false });
                      setValue('gatedCommunityOther', '', { shouldValidate: false });
                    }}
                    className="shrink-0"
                  >
                    Clear
                  </Button>
                )}
              </div>
              {gatedCommunitySelectionValue === OTHER_GATED_COMMUNITY_VALUE && (
                <div className="space-y-1">
                  <Input
                    id="gatedCommunityOther"
                    {...register('gatedCommunityOther', {
                      onChange: () => trigger('gatedCommunityOther'),
                    })}
                    placeholder="Enter custom gated community name"
                    className={errors.gatedCommunityOther ? 'border-red-500' : ''}
                  />
                  {errors.gatedCommunityOther && (
                    <p className="text-xs text-red-600">{errors.gatedCommunityOther.message}</p>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2 bg-white">
                <Label htmlFor="primaryCategory">Primary Category</Label>
                <Select
                  value={primaryCategoryValue}
                  onValueChange={(value) => {
                    setValue('primaryCategory', value as NonNullable<LeadFormData['primaryCategory']>, { shouldValidate: true });
                    setValue('secondaryCategory', '', { shouldValidate: true });
                    setValue('primaryCategoryOther', '');
                    setValue('secondaryCategoryOther', '');
                    trigger('primaryCategory');
                  }}
                >
                  <SelectTrigger id="primaryCategory" className={errors.primaryCategory ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select primary category" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {PRIMARY_CATEGORY_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="hover:bg-gray-100 cursor-pointer"
                      >
                        {option.value === 'other' ? 'Other (Specify Below)' : option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {primaryCategoryValue === 'other' && (
                  <div className="mt-2">
                    <Input
                      id="primaryCategoryOther"
                      {...register('primaryCategoryOther', {
                        onChange: () => trigger('primaryCategoryOther')
                      })}
                      placeholder="Enter custom primary category"
                      className={errors.primaryCategoryOther ? 'border-red-500' : ''}
                    />
                    {errors.primaryCategoryOther && (
                      <p className="text-xs text-red-600 mt-1">{errors.primaryCategoryOther.message}</p>
                    )}
                  </div>
                )}
                {errors.primaryCategory && (
                  <p className="text-sm text-red-600">{errors.primaryCategory.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondaryCategory">
                  Secondary Category
                </Label>
                {primaryCategoryValue && availableSecondaryCategories.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Select
                        value={secondaryCategoryValue || (primaryCategoryValue === 'water-tanker' ? '__general__' : undefined)}
                        onValueChange={(value) => {
                          setValue('secondaryCategory', value === '__general__' ? '' : value, { shouldValidate: true });
                          if (value !== 'other') setValue('secondaryCategoryOther', '');
                          trigger('secondaryCategory');
                        }}
                      >
                        <SelectTrigger 
                          id="secondaryCategory"
                          className={`bg-white flex-1 ${errors.secondaryCategory ? 'border-red-500' : ''}`}
                        >
                          <SelectValue placeholder={primaryCategoryValue === 'water-tanker' ? 'Select or leave as General' : 'Select secondary category'} />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          {primaryCategoryValue === 'water-tanker' && (
                            <SelectItem value="__general__" className="hover:bg-gray-100 cursor-pointer">General water tanker services</SelectItem>
                          )}
                          {availableSecondaryCategories.map((category) => (
                            <SelectItem 
                              key={category} 
                              value={category} 
                              className="hover:bg-gray-100 cursor-pointer"
                            >
                              {category}
                            </SelectItem>
                          ))}
                          <SelectItem value="other" className="hover:bg-gray-100 cursor-pointer">Other (Specify Below)</SelectItem>
                        </SelectContent>
                      </Select>
                      {secondaryCategoryValue && secondaryCategoryValue !== 'other' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setValue('secondaryCategory', '', { shouldValidate: true });
                            setValue('secondaryCategoryOther', '');
                            trigger('secondaryCategory');
                          }}
                          className="shrink-0"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    {secondaryCategoryValue === 'other' && (
                      <div className="mt-1">
                        <Input
                          id="secondaryCategoryOther"
                          {...register('secondaryCategoryOther', {
                            onChange: () => trigger('secondaryCategoryOther')
                          })}
                          placeholder="Enter custom secondary category"
                          className={errors.secondaryCategoryOther ? 'border-red-500' : ''}
                        />
                        {errors.secondaryCategoryOther && (
                          <p className="text-xs text-red-600 mt-1">{errors.secondaryCategoryOther.message}</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : primaryCategoryValue ? (
                  <Input
                    id="secondaryCategory"
                    {...register('secondaryCategory')}
                    placeholder="Enter secondary category"
                    className={errors.secondaryCategory ? 'border-red-500' : ''}
                  />
                ) : (
                  <Input
                    id="secondaryCategory"
                    {...register('secondaryCategory')}
                    placeholder="Select primary category first"
                    disabled={true}
                    className={errors.secondaryCategory ? 'border-red-500' : ''}
                  />
                )}
                {errors.secondaryCategory && (
                  <p className="text-sm text-red-600">{errors.secondaryCategory.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="experienceLevel">Experience Level</Label>
                <Select
                  value={watch('experienceLevel') || undefined}
                  onValueChange={(value) => {
                    setValue('experienceLevel', value as NonNullable<LeadFormData['experienceLevel']>, { shouldValidate: true });
                    trigger('experienceLevel');
                  }}
                >
                  <SelectTrigger 
                    id="experienceLevel"
                    className={errors.experienceLevel ? 'border-red-500' : ''}
                  >
                    <SelectValue placeholder="Select experience level" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="beginner" className="hover:bg-gray-100 cursor-pointer">Beginner (0-1 years)</SelectItem>
                    <SelectItem value="intermediate" className="hover:bg-gray-100 cursor-pointer">Intermediate (2-4 years)</SelectItem>
                    <SelectItem value="experienced" className="hover:bg-gray-100 cursor-pointer">Experienced (5+ years)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.experienceLevel && (
                  <p className="text-sm text-red-600">{errors.experienceLevel.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="workingDays">Working Days</Label>
                <Input
                  id="workingDays"
                  {...register('workingDays')}
                  placeholder="e.g., Mon-Fri, Mon-Sat"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="preferredTimeSlot">Preferred Time Slot</Label>
                <Select
                  value={watch('preferredTimeSlot') || undefined}
                  onValueChange={(value) => setValue('preferredTimeSlot', value, { shouldValidate: false })}
                >
                  <SelectTrigger id="preferredTimeSlot" className="bg-white">
                    <SelectValue placeholder="Select preferred time slot" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Morning" className="hover:bg-gray-100 cursor-pointer">Morning (6 AM - 12 PM)</SelectItem>
                    <SelectItem value="Afternoon" className="hover:bg-gray-100 cursor-pointer">Afternoon (12 PM - 5 PM)</SelectItem>
                    <SelectItem value="Evening" className="hover:bg-gray-100 cursor-pointer">Evening (5 PM - 9 PM)</SelectItem>
                    <SelectItem value="Night" className="hover:bg-gray-100 cursor-pointer">Night (9 PM - 12 AM)</SelectItem>
                    <SelectItem value="Flexible" className="hover:bg-gray-100 cursor-pointer">Flexible</SelectItem>
                    <SelectItem value="Any Time" className="hover:bg-gray-100 cursor-pointer">Any Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Select
                  value={watch('source') || undefined}
                  onValueChange={(value) => setValue('source', value as LeadSource, { shouldValidate: true })}
                >
                  <SelectTrigger id="source" className={errors.source ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent className="bg-white" >
                    <SelectItem value="referral" className="hover:bg-gray-100 cursor-pointer">Referral</SelectItem>
                    <SelectItem value="campaign" className="hover:bg-gray-100 cursor-pointer">Campaign</SelectItem>
                    <SelectItem value="walk-in" className="hover:bg-gray-100 cursor-pointer">Walk-in</SelectItem>
                    <SelectItem value="agent" className="hover:bg-gray-100 cursor-pointer">Agent</SelectItem>
                    <SelectItem value="other" className="hover:bg-gray-100 cursor-pointer">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors.source && (
                  <p className="text-sm text-red-600">{errors.source.message}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
              <Button
                type="submit"
                disabled={createLeadMutation.isPending}
                className="flex-1 w-full sm:w-auto"
              >
                {createLeadMutation.isPending ? 'Creating...' : 'Create Helper'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
