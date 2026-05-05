'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { caosApi } from '@/lib/api/caos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Eye, CalendarClock } from 'lucide-react';
import Link from 'next/link';
import { leadStatusLabel, primaryCategoryLabel } from '@/lib/leadLabels';
import { format } from 'date-fns';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';

const statusColors: Record<string, string> = {
  lead_added: 'bg-gray-100 text-gray-800',
  contacted_not_lifted: 'bg-slate-100 text-slate-800',
  contacted_not_interested: 'bg-blue-100 text-blue-800',
  contacted_interested: 'bg-yellow-100 text-yellow-800',
  documents_submitted: 'bg-purple-100 text-purple-800',
  under_verification: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-500',
};

export default function CallbackQueuePage() {
  const { role, user, loading: authLoading } = useJWTAuth();
  const [searchCity, setSearchCity] = useState('');
  const [searchSkill, setSearchSkill] = useState('');
  const [addedByFilter, setAddedByFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dueType, setDueType] = useState<'all' | 'callback' | 'onboarding'>('all');
  const [bucket, setBucket] = useState<'all' | 'today' | 'overdue' | 'upcoming' | 'range'>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const currentUserId =
    user?.userId ||
    (user && typeof user === 'object' && 'uid' in user && typeof user.uid === 'string'
      ? user.uid
      : undefined);
  const isQualifier = role === 'qualifier';
  const isReady = !isQualifier || !!currentUserId;

  const { data: creatorsData } = useQuery({
    queryKey: ['follow-up-creators'],
    queryFn: () => caosApi.getLeadCreators(),
    enabled: !isQualifier,
  });
  const leadCreators = creatorsData?.data || [];

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['follow-up-queue', page, searchCity, searchSkill, addedByFilter, currentUserId, startDate, endDate, dueType, bucket],
    queryFn: () =>
      caosApi.getFollowUpQueue({
        city: searchCity || undefined,
        primarySkill: searchSkill || undefined,
        addedBy: isQualifier ? currentUserId : (addedByFilter !== 'all' ? addedByFilter : undefined),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        dueType,
        bucket,
        page,
        limit,
      }),
    enabled: isReady,
    keepPreviousData: true,
    refetchInterval: 60_000,
    retry: 2,
  });
  const { data: statsData, isError: statsError, error: statsErrorObj } = useQuery({
    queryKey: ['follow-up-queue-stats', addedByFilter, currentUserId],
    queryFn: () =>
      caosApi.getFollowUpQueueStats({
        addedBy: isQualifier ? currentUserId : (addedByFilter !== 'all' ? addedByFilter : undefined),
      }),
    enabled: isReady,
    keepPreviousData: true,
    refetchInterval: 60_000,
    retry: 2,
  });

  if (authLoading || !isReady || isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isError || statsError) {
    const message =
      (error as Error | undefined)?.message ||
      (statsErrorObj as Error | undefined)?.message ||
      'Failed to load follow-ups.';

    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-sm text-gray-600">{message}</p>
        </div>
      </div>
    );
  }

  const leads = data?.data || [];
  const total = data?.pagination?.total || 0;
  const followUpStats = statsData?.data;

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Follow-up Queue</h1>
        <span className="inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-800 text-sm font-semibold px-3 py-1">
          {total} {total === 1 ? 'follow-up' : 'follow-ups'}
        </span>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-5">
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Follow-ups</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{followUpStats?.totalFollowUps ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 shadow-sm">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Callback Overdue</p>
            <p className="mt-2 text-2xl font-bold text-red-700">{followUpStats?.callbackOverdue ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 shadow-sm">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Callback Due Today</p>
            <p className="mt-2 text-2xl font-bold text-amber-700">{followUpStats?.callbackDueToday ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 shadow-sm">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Onboarding Overdue</p>
            <p className="mt-2 text-2xl font-bold text-red-700">{followUpStats?.onboardingOverdue ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 shadow-sm">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Onboarding Due Today</p>
            <p className="mt-2 text-2xl font-bold text-amber-700">{followUpStats?.onboardingDueToday ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardContent className="pt-4 sm:pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-8 gap-3 sm:gap-4">
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
                className="mt-1.5"
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
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="start-date" className="text-sm font-medium text-gray-700">From</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="end-date" className="text-sm font-medium text-gray-700">To</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="mt-1.5"
              />
            </div>
            {!isQualifier && (
              <div>
                <Label htmlFor="added-by-filter" className="text-sm font-medium text-gray-700">Qualifier</Label>
                <Select
                  value={addedByFilter}
                  onValueChange={(value) => {
                    setAddedByFilter(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger id="added-by-filter" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All</SelectItem>
                    {leadCreators.map((creator) => (
                      <SelectItem key={creator.userId} value={creator.userId}>
                        {creator.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="due-type-filter" className="text-sm font-medium text-gray-700">Due Type</Label>
              <Select value={dueType} onValueChange={(value: 'all' | 'callback' | 'onboarding') => {
                setDueType(value);
                setPage(1);
              }}>
                <SelectTrigger id="due-type-filter" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="callback">Callback</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="bucket-filter" className="text-sm font-medium text-gray-700">Bucket</Label>
              <Select value={bucket} onValueChange={(value: 'all' | 'today' | 'overdue' | 'upcoming' | 'range') => {
                setBucket(value);
                setPage(1);
              }}>
                <SelectTrigger id="bucket-filter" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="range">Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchCity('');
                  setSearchSkill('');
                  setAddedByFilter('all');
                  setStartDate('');
                  setEndDate('');
                  setDueType('all');
                  setBucket('all');
                  setPage(1);
                }}
                className="w-full"
              >
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Follow-up Items</CardTitle>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <div className="text-center py-12">
              <CalendarClock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No follow-ups scheduled</p>
              <p className="text-sm text-gray-500 mt-2">
                Callback and onboarding follow-ups will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Due Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Due At</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Reason</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {leads.map((lead) => (
                      <tr key={lead.leadId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{lead.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{lead.phone || lead.landline || '-'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={lead.dueType === 'callback' ? 'bg-indigo-100 text-indigo-800' : 'bg-cyan-100 text-cyan-800'}>
                            {lead.dueType === 'callback' ? 'Callback' : 'Onboarding'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {lead.dueAt ? (
                            <div className="space-y-1">
                              <div>{format(new Date(lead.dueAt), 'MMM dd, yyyy hh:mm a')}</div>
                              {new Date(lead.dueAt) < new Date() ? (
                                <Badge className="bg-red-100 text-red-800">Overdue</Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-800">Upcoming</Badge>
                              )}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={statusColors[lead.status] || 'bg-gray-100 text-gray-800'}>
                            {leadStatusLabel(lead.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {primaryCategoryLabel(
                            lead.primaryCategory ||
                              (typeof (lead as { primarySkill?: unknown }).primarySkill === 'string'
                                ? ((lead as { primarySkill?: string }).primarySkill || undefined)
                                : undefined)
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {lead.statusReasonText || lead.statusReasonCode || '-'}
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

              {total > limit && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
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

