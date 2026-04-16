'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { caosApi, type LeadSource } from '@/lib/api/caos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';

type LeadFormData = {
  name: string;
  phone: string;
  landline: string;
  email: string;
  city?: string;
  address?: string;
  pincode?: string;
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
    | 'other';
  secondaryCategory?: string;
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
    'other'
  ]).optional(),
  secondaryCategory: z.string().default(''),
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
    const trimmed = (data.secondaryCategory ?? '').trim();
    if (trimmed === 'other') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Please specify the secondary category', path: ['secondaryCategory'] });
    }
  });

export default function AddLeadPage() {
  const router = useRouter();
  const { role, loading: authLoading } = useJWTAuth();
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [primaryCategoryCustom, setPrimaryCategoryCustom] = useState('');
  const [secondaryCategoryCustom, setSecondaryCategoryCustom] = useState('');

  // Onboarder cannot add leads; redirect to dashboard
  useEffect(() => {
    if (!authLoading && role === 'onboarder') {
      router.replace('/dashboard');
    }
  }, [authLoading, role, router]);
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
    // Validation works correctly at runtime, so we suppress this one type-level mismatch.
    // @ts-expect-error Resolver type mismatch is safe to ignore here
    resolver: zodResolver(leadSchema),
    defaultValues: {
      source: undefined,
    },
  });

  const primaryCategoryValue = watch('primaryCategory');
  const secondaryCategoryValue = watch('secondaryCategory');

  const phoneValue = watch('phone');

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
    'ac-repair-service': [
      'AC Service',
      'AC Repair',
      'AC Installation'
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
          `Duplicate found: Tasker ${result.data.existingLead.leadId} (${result.data.existingLead.status})`
        );
      } else {
        setDuplicateWarning(null);
      }
    } catch (error) {
      // Ignore duplicate check errors
    }
  };

  const createLeadMutation = useMutation<
    Awaited<ReturnType<typeof caosApi.createLead>>,
    Error,
    Parameters<typeof caosApi.createLead>[0]
  >({
    mutationFn: (data: Parameters<typeof caosApi.createLead>[0]) => caosApi.createLead(data),
    onSuccess: (response) => {
      toast.success('Tasker created successfully!');
      router.push(`/leads/${response.data.leadId}`);
    },
    onError: (error: any) => {
      if (error.message.includes('Duplicate')) {
        toast.error('Duplicate tasker found. Please check existing taskers.');
      } else {
        toast.error(error.message || 'Failed to create tasker');
      }
    },
    onSettled: () => {
      submittingRef.current = false;
    },
  });

  // Use a loosely-typed submit handler to avoid React Hook Form generic incompatibilities
  const onSubmit = async (data: LeadFormData) => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    // Check duplicate one more time before submitting
    if (data.phone?.trim()) {
      await checkDuplicate(data.phone.trim(), 'phone');
    }
    if (data.landline?.trim()) {
      await checkDuplicate(data.landline.trim(), 'landline');
    }
    
    if (duplicateWarning) {
      toast.warning('Please resolve duplicate before creating tasker');
      submittingRef.current = false;
      return;
    }

    // Ensure at least one contact number is provided
    if (!data.phone?.trim() && !data.landline?.trim()) {
      toast.error('At least one contact number (Mobile or Landline) is required');
      submittingRef.current = false;
      return;
    }

    const resolvedPrimaryCategory =
      data.primaryCategory === 'other'
        ? primaryCategoryCustom.trim()
        : (data.primaryCategory || '').trim();
    if (data.primaryCategory === 'other' && !resolvedPrimaryCategory) {
      toast.error('Please enter custom primary category');
      submittingRef.current = false;
      return;
    }

    const resolvedSecondaryCategory =
      data.secondaryCategory === 'other'
        ? secondaryCategoryCustom.trim()
        : (data.secondaryCategory || '').trim();
    if (data.secondaryCategory === 'other' && !resolvedSecondaryCategory) {
      toast.error('Please enter custom secondary category');
      submittingRef.current = false;
      return;
    }

    const normalizedPhone = data.phone?.trim() || '';
    const normalizedLandline = data.landline?.trim() || '';

    const payload: Parameters<typeof caosApi.createLead>[0] = {
      ...data,
      phone: normalizedPhone || undefined,
      landline: normalizedLandline || undefined,
      city: data.city?.trim() || undefined,
      address: data.address?.trim() || undefined,
      pincode: data.pincode?.trim() || undefined,
      source: data.source || undefined,
      experienceLevel: data.experienceLevel || undefined,
      primaryCategory: resolvedPrimaryCategory || undefined,
      secondaryCategory:
        data.secondaryCategory === '__general__' ? '' : (resolvedSecondaryCategory || ''),
    };
    createLeadMutation.mutate(payload);
  };

  if (!authLoading && role === 'onboarder') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-amber-500 border-r-transparent" />
      </div>
    );
  }

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
          <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-3 sm:space-y-4">
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

            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2 bg-white">
                <Label htmlFor="primaryCategory">Primary Category</Label>
                <Select
                  value={primaryCategoryValue}
                  onValueChange={(value) => {
                    setValue('primaryCategory', value as any, { shouldValidate: true });
                    setValue('secondaryCategory', '', { shouldValidate: true }); // Reset secondary category when primary changes
                    setPrimaryCategoryCustom('');
                    setSecondaryCategoryCustom('');
                    trigger('primaryCategory');
                    trigger('secondaryCategory');
                  }}
                >
                  <SelectTrigger id="primaryCategory" className={errors.primaryCategory ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select primary category" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="cleaning" className="hover:bg-gray-100 cursor-pointer">Cleaning</SelectItem>
                    <SelectItem value="handyperson" className="hover:bg-gray-100 cursor-pointer">Handyperson</SelectItem>
                    <SelectItem value="moving" className="hover:bg-gray-100 cursor-pointer">Moving & Delivery</SelectItem>
                    <SelectItem value="gardening" className="hover:bg-gray-100 cursor-pointer">Gardening</SelectItem>
                    <SelectItem value="business" className="hover:bg-gray-100 cursor-pointer">Business Services</SelectItem>
                    <SelectItem value="marketing" className="hover:bg-gray-100 cursor-pointer">Marketing & Design</SelectItem>
                    <SelectItem value="tech" className="hover:bg-gray-100 cursor-pointer">Tech Support</SelectItem>
                    <SelectItem value="tutoring" className="hover:bg-gray-100 cursor-pointer">Tutoring</SelectItem>
                    <SelectItem value="photography" className="hover:bg-gray-100 cursor-pointer">Photography</SelectItem>
                    <SelectItem value="beauty" className="hover:bg-gray-100 cursor-pointer">Beauty & Wellness</SelectItem>
                    <SelectItem value="pet-care" className="hover:bg-gray-100 cursor-pointer">Pet Care</SelectItem>
                    <SelectItem value="events" className="hover:bg-gray-100 cursor-pointer">Events & Entertainment</SelectItem>
                    <SelectItem value="water-tanker" className="hover:bg-gray-100 cursor-pointer">Water & Tanker Services</SelectItem>
                    <SelectItem value="ac-repair-service" className="hover:bg-gray-100 cursor-pointer">AC Repair & Service</SelectItem>
                    <SelectItem value="other" className="hover:bg-gray-100 cursor-pointer">Other</SelectItem>
                  </SelectContent>
                </Select>
                {primaryCategoryValue === 'other' && (
                  <div className="mt-2">
                    <Input
                      id="primaryCategoryOther"
                      value={primaryCategoryCustom}
                      placeholder="Enter custom primary category"
                      onChange={(e) => setPrimaryCategoryCustom(e.target.value)}
                    />
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
                  <div className="flex gap-2">
                    <Select
                      value={secondaryCategoryValue || (primaryCategoryValue === 'water-tanker' ? '__general__' : undefined)}
                      onValueChange={(value) => {
                        setValue('secondaryCategory', value === '__general__' ? '' : value, { shouldValidate: true });
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
                        {primaryCategoryValue !== 'water-tanker' && (
                          <SelectItem value="other" className="hover:bg-gray-100 cursor-pointer">Other (specify below)</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {secondaryCategoryValue && secondaryCategoryValue !== 'other' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setValue('secondaryCategory', '', { shouldValidate: true });
                          trigger('secondaryCategory');
                        }}
                        className="shrink-0"
                      >
                        Clear
                      </Button>
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
                {secondaryCategoryValue === 'other' && (
                  <div className="mt-2">
                    <Input
                      id="secondaryCategoryOther"
                      value={secondaryCategoryCustom}
                      placeholder="Enter custom secondary category"
                      className={errors.secondaryCategory ? 'border-red-500' : ''}
                      onChange={(e) => {
                        setSecondaryCategoryCustom(e.target.value);
                      }}
                    />
                    {errors.secondaryCategory && (
                      <p className="text-sm text-red-600 mt-1">Please enter a custom secondary category</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="experienceLevel">Experience Level</Label>
                <Select
                  value={watch('experienceLevel') || undefined}
                  onValueChange={(value) => {
                    setValue('experienceLevel', value as any, { shouldValidate: true });
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
                {createLeadMutation.isPending ? 'Creating...' : 'Create Tasker'}
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

