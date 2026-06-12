'use client';

import { useState, useEffect } from 'react';
import { useSessionStorage } from '@/lib/hooks/useSessionStorage';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { caosApi, type Lead } from '@/lib/api/caos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, ShieldAlert, Eye, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { PRIMARY_CATEGORY_OPTIONS, primaryCategoryLabel } from '@/lib/leadLabels';
import { format } from 'date-fns';

type RegistrationView = 'registered' | 'registered_verified';

function getRegistrationLabel(lead: Lead): { label: string; className: string } {
  const conversion = lead.conversionData;
  if (!conversion?.platformUid) {
    return { label: 'Not registered', className: 'bg-gray-100 text-gray-800' };
  }
  if (conversion.isAadhaarVerified) {
    return { label: 'Registered & verified', className: 'bg-green-100 text-green-800' };
  }
  return { label: 'Registered', className: 'bg-amber-100 text-amber-800' };
}

export default function RegisteredCandidatesPage() {
  const router = useRouter();
  const { role, user, loading: authLoading } = useJWTAuth();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('lastLeadsPath', '/leads/registered');
    }
  }, []);

  const [searchCity, setSearchCity] = useSessionStorage('registered-searchCity', '');
  const [searchSkill, setSearchSkill] = useSessionStorage('registered-searchSkill', '');
  const [registrationView, setRegistrationView] = useSessionStorage<RegistrationView>('registered-registrationView', 'registered');
  const [qualifierId, setQualifierId] = useSessionStorage<string>('registered-qualifierId', 'all');
  const [page, setPage] = useSessionStorage('registered-page', 1);
  const limit = 20;

  const currentUserId =
    user?.userId ||
    (user && typeof user === 'object' && 'uid' in user && typeof user.uid === 'string'
      ? user.uid
      : undefined);

  const canAccess =
    !authLoading && (role === 'onboarder' || role === 'lead_access_manager');

  useEffect(() => {
    if (!authLoading && role === 'qualifier') {
      router.replace('/leads');
    }
  }, [authLoading, role, router]);

  useEffect(() => {
    if (!authLoading && !canAccess) {
      toast.error('You do not have permission to access registered candidates.');
      router.push('/leads');
    }
  }, [authLoading, canAccess, router]);

  const creatorsQuery = useQuery({
    queryKey: ['lead-creators'],
    queryFn: () => caosApi.getLeadCreators(),
    enabled: mounted && canAccess && role === 'lead_access_manager',
  });

  const scopedOwnerId = role === 'lead_access_manager'
    ? (qualifierId !== 'all' ? qualifierId : undefined)
    : role === 'qualifier' || role === 'onboarder'
      ? currentUserId
      : undefined;
  /** Onboarder: same scope as performance (picked, added, or status updates), not only current claims. */
  const scopedPickedBy = undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['registered-candidates', role, currentUserId, registrationView, page, searchCity, searchSkill, qualifierId],
    queryFn: () =>
      caosApi.searchLeads({
        registrationStatus: registrationView,
        city: searchCity || undefined,
        primarySkill: searchSkill || undefined,
        ownerBy: scopedOwnerId,
        pickedBy: scopedPickedBy || undefined,
        page,
        limit,
      }),
    enabled: mounted && canAccess && !!currentUserId,
  });

  if (!mounted || authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <ShieldAlert className="h-16 w-16 text-red-500" />
        <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
        <p className="text-gray-600">You do not have permission to access registered candidates.</p>
        <Link href="/leads">
          <Button variant="outline">Go to Partner List</Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const leads = data?.data || [];
  const total = data?.pagination?.total || 0;

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Registered Candidates</h1>
        <span className="inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-800 text-sm font-semibold px-3 py-1">
          {total} {total === 1 ? 'person' : 'people'}
        </span>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardContent className="pt-4 sm:pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <Label htmlFor="registration-view" className="text-sm font-medium text-gray-700">Type</Label>
              <Select
                value={registrationView}
                onValueChange={(value: RegistrationView) => {
                  setRegistrationView(value);
                  setPage(1);
                }}
              >
                <SelectTrigger id="registration-view" className="mt-1.5 border-gray-300 focus:border-amber-500 focus:ring-amber-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="registered">Registered</SelectItem>
                  <SelectItem value="registered_verified">Registered & Verified</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="city-filter" className="text-sm font-medium text-gray-700">City</Label>
              <Input
                id="city-filter"
                value={searchCity}
                onChange={(e) => {
                  setSearchCity(e.target.value);
                  setPage(1);
                }}
                placeholder="Filter by city..."
                className="mt-1.5 border-gray-300 focus:border-amber-500 focus:ring-amber-500"
              />
            </div>
            <div>
              <Label htmlFor="category-filter" className="text-sm font-medium text-gray-700">Category</Label>
              <Select
                value={searchSkill || 'all'}
                onValueChange={(value) => {
                  setSearchSkill(value === 'all' ? '' : value);
                  setPage(1);
                }}
              >
                <SelectTrigger id="category-filter" className="mt-1.5 border-gray-300 focus:border-amber-500 focus:ring-amber-500">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {PRIMARY_CATEGORY_OPTIONS.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            { (role === 'onboarder' || role === 'lead_access_manager') && (
              <div>
                <Label htmlFor="qualifier-filter" className="text-sm font-medium text-gray-700">Qualifier</Label>
                <Select
                  value={qualifierId}
                  onValueChange={(value) => {
                    setQualifierId(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger id="qualifier-filter" className="mt-1.5 border-gray-300 focus:border-amber-500 focus:ring-amber-500">
                    <SelectValue placeholder="All qualifiers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All qualifiers</SelectItem>
                    {(creatorsQuery.data?.data || []).map((creator) => (
                      <SelectItem key={creator.userId} value={creator.userId}>
                        {creator.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchCity('');
                  setSearchSkill('');
                  setRegistrationView('registered');
                  setQualifierId('all');
                  setPage(1);
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            {registrationView === 'registered' ? 'Registered Candidates' : 'Registered & Verified Candidates'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <div className="text-center py-12">
              <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No candidates found</p>
              <p className="text-sm text-gray-500 mt-2">
                {searchCity || searchSkill
                  ? 'Try adjusting your filters'
                  : registrationView === 'registered'
                    ? 'Candidates registered on platform will appear here'
                    : 'Candidates registered and Aadhaar-verified will appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Contact</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Location</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Registration</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {leads.map((lead) => {
                      const contact = [lead.phone, lead.landline].filter(Boolean).join(', ');
                      const registration = getRegistrationLabel(lead);
                      return (
                        <tr key={lead.leadId} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{lead.name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {lead.createdAt ? format(new Date(lead.createdAt), 'MMM dd, yyyy') : '-'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <div>{contact || '-'}</div>
                            {lead.email && <div className="text-xs text-gray-500">{lead.email}</div>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <div>{lead.city || '-'}</div>
                            {lead.state && <div className="text-xs text-gray-500">{lead.state}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="text-xs">
                              {primaryCategoryLabel(
                                lead.primaryCategory ||
                                  (typeof (lead as { primarySkill?: unknown }).primarySkill === 'string'
                                    ? ((lead as { primarySkill?: string }).primarySkill || undefined)
                                    : undefined)
                              )}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`text-xs ${registration.className}`}>
                              {registration.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Link href={`/leads/${lead.leadId}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {total > limit && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} candidates
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page * limit >= total}
                    >
                      Next
                    </Button>
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

