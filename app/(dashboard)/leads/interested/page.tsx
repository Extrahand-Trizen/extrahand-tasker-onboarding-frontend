'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Loader2, Heart, ShieldAlert, Eye } from 'lucide-react';
import Link from 'next/link';
import { PRIMARY_CATEGORY_OPTIONS, leadStatusLabel, primaryCategoryLabel } from '@/lib/leadLabels';
import { format } from 'date-fns';

const statusColors: Record<Lead['status'], string> = {
  lead_added: 'bg-gray-100 text-gray-800',
  contacted_not_lifted: 'bg-slate-100 text-slate-800',
  contacted_not_interested: 'bg-blue-100 text-blue-800',
  contacted_interested: 'bg-yellow-100 text-yellow-800',
  documents_submitted: 'bg-purple-100 text-purple-800',
  under_verification: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-500',
};

function getRegistrationLabel(lead: Lead): { label: string; className: string } {
  const cd = lead.conversionData;
  const hasUid = !!(cd?.platformUid);
  const hasActivationUid = !!(lead.activationData?.firebaseUid);
  const hasAccount = ['invited', 'activated', 'suspended'].includes(lead.accountStatus);
  const isRegistered = hasUid || hasActivationUid || hasAccount;
  const verified = !!cd?.isAadhaarVerified || lead.verificationStatus?.aadhaar?.status === 'verified';
  if (!isRegistered) return { label: 'Not registered', className: 'bg-gray-100 text-gray-800' };
  if (!verified) return { label: 'Registered', className: 'bg-amber-100 text-amber-800' };
  return { label: 'Registered and verified', className: 'bg-green-100 text-green-800' };
}

function getLatestStatusTransition(
  lead: Lead,
  targetStatus: Lead['status']
): { changedBy?: string; changedByName?: string; changedAt?: string } | undefined {
  const history = lead.statusHistory || [];
  const match = [...history]
    .filter((entry) => entry.status === targetStatus)
    .sort(
      (a, b) =>
        new Date(b.changedAt || 0).getTime() - new Date(a.changedAt || 0).getTime()
    )[0];

  if (!match) return undefined;
  return {
    changedBy: match.changedBy,
    changedByName: match.changedByName,
    changedAt: match.changedAt,
  };
}

export default function InterestedCandidatesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { role, user, loading: authLoading } = useJWTAuth();
  const [searchCity, setSearchCity] = useState('');
  const [searchSkill, setSearchSkill] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [registrationFilter, setRegistrationFilter] = useState<'all' | 'not_registered' | 'registered' | 'registered_verified'>('all');
  const [qualifierId, setQualifierId] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const canAccess = !authLoading && (role === 'qualifier' || role === 'onboarder' || role === 'lead_access_manager');
  const isManagerView = role === 'lead_access_manager';
  const currentUserId =
    user?.userId ||
    (user && typeof user === 'object' && 'uid' in user && typeof user.uid === 'string'
      ? user.uid
      : undefined);

  useEffect(() => {
    if (!authLoading && !canAccess) {
      toast.error('You do not have permission to access the interested candidates queue.');
      router.push('/leads');
    }
  }, [authLoading, canAccess, router]);

  const creatorsQuery = useQuery({
    queryKey: ['qualifiers'],
    queryFn: () => caosApi.getQualifiers(),
    enabled: canAccess && isManagerView,
  });

  const scopedOwnerId = isManagerView
    ? (qualifierId !== 'all' ? qualifierId : undefined)
    : role === 'qualifier'
      ? currentUserId
      : undefined;
  const scopedPickedBy = role === 'onboarder' ? currentUserId : undefined;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['interested-candidates', role, user?.userId, page, searchCity, searchSkill, searchPhone, registrationFilter, qualifierId],
    queryFn: () => caosApi.getInterestedCandidates({
      city: searchCity,
      primarySkill: searchSkill,
      search: searchPhone,
      page,
      limit,
      registrationStatus: registrationFilter === 'all' ? undefined : registrationFilter,
      ownerBy: scopedOwnerId,
      pickedBy: scopedPickedBy,
    }),
    enabled: canAccess && !!currentUserId,
  });

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Show unauthorized message if user doesn't have access
  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <ShieldAlert className="h-16 w-16 text-red-500" />
        <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
        <p className="text-gray-600">You do not have permission to access the interested candidates queue.</p>
        <p className="text-sm text-gray-500">Only authorized roles can view interested candidates.</p>
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

  const leads = data?.data.leads || [];
  const total = data?.data.total || 0;

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Interested Candidates</h1>
        <span className="inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-800 text-sm font-semibold px-3 py-1">
          {total} {total === 1 ? 'person' : 'people'}
        </span>
      </div>

      {/* Filters */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="pt-4 sm:pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
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
            <div>
              <Label htmlFor="registration-filter" className="text-sm font-medium text-gray-700">Registration status</Label>
              <Select
                value={registrationFilter}
                onValueChange={(value: 'all' | 'not_registered' | 'registered' | 'registered_verified') => {
                  setRegistrationFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger id="registration-filter" className="mt-1.5 border-gray-300 focus:border-amber-500 focus:ring-amber-500">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="not_registered">Not registered</SelectItem>
                  <SelectItem value="registered">Registered</SelectItem>
                  <SelectItem value="registered_verified">Registered and verified</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isManagerView && (
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
                    {(creatorsQuery.data?.data || []).map((qualifier) => (
                      <SelectItem key={qualifier.userId} value={qualifier.userId}>
                        {qualifier.name || qualifier.email || qualifier.userId}
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
                  setSearchPhone('');
                  setRegistrationFilter('all');
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

      {/* Candidates List */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Interested Candidates</CardTitle>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No interested candidates found</p>
              <p className="text-sm text-gray-500 mt-2">
                {searchCity || searchSkill || searchPhone
                  ? 'Try adjusting your filters'
                  : 'Qualifier team will move leads to "Interested" status when candidates show interest'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Registration
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Moved By
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {leads.map((lead) => {
                      const reg = getRegistrationLabel(lead);
                      const moved = getLatestStatusTransition(lead, 'contacted_interested');
                      const contact = [lead.phone, (lead as any).landline].filter(Boolean).join(', ');
                      return (
                      <tr key={lead.leadId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{lead.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {lead.createdAt ? format(new Date(lead.createdAt), 'MMM dd, yyyy') : '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div>{contact}</div>
                          {lead.email && <div className="text-xs text-gray-500">{lead.email}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div>{lead.city}</div>
                          {lead.state && <div className="text-xs text-gray-500">{lead.state}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-xs">
                            {primaryCategoryLabel(lead.primaryCategory || (lead as any).primarySkill)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`text-xs ${reg.className}`}>
                            {reg.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div>{moved?.changedByName || moved?.changedBy || '-'}</div>
                          {moved?.changedAt && (
                            <div className="text-xs text-gray-500">
                              {format(new Date(moved.changedAt), 'MMM dd, yyyy p')}
                            </div>
                          )}
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
                    );})}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {leads.map((lead) => {
                  const reg = getRegistrationLabel(lead);
                  const moved = getLatestStatusTransition(lead, 'contacted_interested');
                  const contact = [lead.phone, (lead as any).landline].filter(Boolean).join(', ');
                  return (
                  <Card key={lead.leadId} className="border-gray-200">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{lead.name}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {lead.createdAt ? format(new Date(lead.createdAt), 'MMM dd, yyyy') : '-'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={statusColors[lead.status]}>
                            {leadStatusLabel(lead.status)}
                          </Badge>
                          <Badge className={`text-xs ${reg.className}`}>
                            {reg.label}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-500">Phone:</span>{' '}
                          <span className="text-gray-900">{contact}</span>
                        </div>
                        {lead.email && (
                          <div>
                            <span className="text-gray-500">Email:</span>{' '}
                            <span className="text-gray-900">{lead.email}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">Location:</span>{' '}
                          <span className="text-gray-900">
                            {lead.city}
                            {lead.state && `, ${lead.state}`}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Category:</span>{' '}
                          <Badge variant="secondary" className="text-xs ml-1">
                            {primaryCategoryLabel(lead.primaryCategory || (lead as any).primarySkill)}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-gray-500">Moved By:</span>{' '}
                          <span className="text-gray-900">
                            {moved?.changedByName || moved?.changedBy || '-'}
                          </span>
                        </div>
                        {moved?.changedAt && (
                          <div>
                            <span className="text-gray-500">Moved At:</span>{' '}
                            <span className="text-gray-900">
                              {format(new Date(moved.changedAt), 'MMM dd, yyyy p')}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4">
                        <Link href={`/leads/${lead.leadId}`}>
                          <Button variant="outline" size="sm" className="w-full">
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );})}
              </div>

              {/* Pagination */}
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
