'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { caosApi, type Lead } from '@/lib/api/caos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, UserX, ShieldAlert, Eye } from 'lucide-react';
import Link from 'next/link';
import { leadStatusLabel, primaryCategoryLabel } from '@/lib/leadLabels';
import { format } from 'date-fns';

const statusColors: Record<Lead['status'], string> = {
  lead_added: 'bg-gray-100 text-gray-800',
  contacted_not_interested: 'bg-blue-100 text-blue-800',
  contacted_interested: 'bg-yellow-100 text-yellow-800',
  documents_submitted: 'bg-purple-100 text-purple-800',
  under_verification: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-500',
};

export default function NotInterestedCandidatesPage() {
  const router = useRouter();
  const { role, loading: authLoading } = useJWTAuth();
  const [searchCity, setSearchCity] = useState('');
  const [searchSkill, setSearchSkill] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const canAccess = !authLoading && (role === 'onboarder' || role === 'lead_access_manager');

  useEffect(() => {
    if (!authLoading && !canAccess) {
      toast.error('You do not have permission to access this queue. Only onboarder and admin teams can view this.');
      router.push('/leads');
    }
  }, [authLoading, canAccess, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['not-interested-candidates', page, searchCity, searchSkill],
    queryFn: () => caosApi.getNotInterestedCandidates({ city: searchCity, primarySkill: searchSkill, page, limit }),
    enabled: canAccess,
  });

  if (authLoading) {
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
        <p className="text-gray-600">You do not have permission to access the contacted & not interested queue.</p>
        <p className="text-sm text-gray-500">Only onboarder and admin teams can view this.</p>
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
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Contacted & Not Interested</h1>
        <span className="inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-800 text-sm font-semibold px-3 py-1">
          {total} {total === 1 ? 'person' : 'people'}
        </span>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardContent className="pt-4 sm:pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
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
              <Label htmlFor="skill-filter" className="text-sm font-medium text-gray-700">Primary Skill</Label>
              <Input
                id="skill-filter"
                value={searchSkill}
                onChange={(e) => {
                  setSearchSkill(e.target.value);
                  setPage(1);
                }}
                placeholder="Filter by skill..."
                className="mt-1.5 border-gray-300 focus:border-amber-500 focus:ring-amber-500"
              />
            </div>
            <div className="flex items-end sm:col-span-2 md:col-span-1">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchCity('');
                  setSearchSkill('');
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
          <CardTitle className="text-lg font-semibold text-gray-900">Contacted & Not Interested</CardTitle>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <div className="text-center py-12">
              <UserX className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No candidates found</p>
              <p className="text-sm text-gray-500 mt-2">
                {searchCity || searchSkill
                  ? 'Try adjusting your filters'
                  : 'Leads moved to "Contacted & Not Interested" will appear here'}
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
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Primary Skill</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {leads.map((lead) => (
                      <tr key={lead.leadId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{lead.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {lead.createdAt ? format(new Date(lead.createdAt), 'MMM dd, yyyy') : '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div>{lead.phone}</div>
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
                          <Link href={`/leads/${lead.leadId}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-4">
                {leads.map((lead) => (
                  <Card key={lead.leadId} className="border-gray-200">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{lead.name}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {lead.createdAt ? format(new Date(lead.createdAt), 'MMM dd, yyyy') : '-'}
                          </p>
                        </div>
                        <Badge className={statusColors[lead.status]}>
                          {leadStatusLabel(lead.status)}
                        </Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div><span className="text-gray-500">Phone:</span> <span className="text-gray-900">{lead.phone}</span></div>
                        {lead.email && <div><span className="text-gray-500">Email:</span> <span className="text-gray-900">{lead.email}</span></div>}
                        <div><span className="text-gray-500">Location:</span> <span className="text-gray-900">{lead.city}{lead.state ? `, ${lead.state}` : ''}</span></div>
                        <div>
                          <span className="text-gray-500">Primary Skill:</span>{' '}
                          <Badge variant="secondary" className="text-xs ml-1">
                            {primaryCategoryLabel(lead.primaryCategory || (lead as any).primarySkill)}
                          </Badge>
                        </div>
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
                ))}
              </div>

              {total > limit && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} candidates
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page * limit >= total}>
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
