'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { caosApi } from '@/lib/api/caos';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { useSessionStorage } from '@/lib/hooks/useSessionStorage';
import { Loader2, ArrowLeft, PencilLine } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type DatePreset = 'today' | 'last_7_days' | 'all_time';

function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateRangeFromPreset(preset: 'today' | 'last_7_days'): { from: string; to: string } {
  const today = new Date();
  const to = formatDateInputValue(today);

  if (preset === 'today') {
    return { from: to, to };
  }

  // last_7_days: today back 6 days (7-day window inclusive)
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 6);
  return { from: formatDateInputValue(fromDate), to };
}

export default function PerformanceUserDetailsPage() {
  const { role, user: currentUser, loading } = useJWTAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const userId = params?.userId as string;

  const currentUserId =
    currentUser?.userId ||
    (currentUser && typeof currentUser === "object" && "uid" in currentUser && typeof currentUser.uid === "string"
      ? currentUser.uid
      : undefined);

  const isManagerView = role === 'lead_access_manager';
  const isSelf = !!currentUserId && userId === currentUserId;
  const hasAccess = isManagerView || isSelf;

  const [datePreset, setDatePreset] = useSessionStorage<DatePreset>('performance-detail-datePreset', 'all_time');

  // Derive from/to/allTime from the selected preset
  const { from, to, allTime } = useMemo(() => {
    if (datePreset === 'all_time') {
      return { from: undefined, to: undefined, allTime: true };
    }
    const range = getDateRangeFromPreset(datePreset);
    return { from: range.from, to: range.to, allTime: false };
  }, [datePreset]);

  const { data: response, isLoading } = useQuery({
    queryKey: ['performance-details', userId, datePreset],
    queryFn: () => caosApi.getPerformanceDetails({ userId, from, to, allTime }),
    enabled: hasAccess && !!userId,
  });

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-gray-500">
        You do not have permission to view this page.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const data = response?.data;
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <p className="text-gray-500">User performance details not found.</p>
        {isManagerView && (
          <Link
            href={`/leads/performance?tab=${searchParams.get('tab') || 'all'}`}
            className="text-amber-600 hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Performance
          </Link>
        )}
      </div>
    );
  }

  const { user, claims, rankLabel, followUps, outcomes, editedLeads, totalLeadsInRange } = data;

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const getAvatarColors = (name: string) => {
    const colorPairs = [
      { bg: 'bg-indigo-50/70', text: 'text-indigo-700' },
      { bg: 'bg-emerald-50/70', text: 'text-emerald-700' },
      { bg: 'bg-amber-50/70', text: 'text-amber-700' },
      { bg: 'bg-rose-50/70', text: 'text-rose-700' },
      { bg: 'bg-sky-50/70', text: 'text-sky-700' },
      { bg: 'bg-fuchsia-50/70', text: 'text-fuchsia-700' },
      { bg: 'bg-violet-50/70', text: 'text-violet-700' },
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const pair = colorPairs[Math.abs(hash) % colorPairs.length];
    return `${pair.bg} ${pair.text}`;
  };

  const totalLeadsCount =
    datePreset === 'all_time'
      ? (data.totalLeads ?? claims)
      : (totalLeadsInRange ?? data.totalLeads ?? 0);
  const conversionRate =
    totalLeadsCount > 0 && outcomes?.totalRegistered !== undefined
      ? ((outcomes.totalRegistered / totalLeadsCount) * 100).toFixed(1)
      : '0.0';

  const isQualifier = user.role === 'qualifier';

  // Label for the date-range sub-text shown under Edited Leads
  const dateRangeLabel =
    datePreset === 'today'
      ? 'today'
      : datePreset === 'last_7_days'
        ? 'last 7 days'
        : 'all time';

  return (
    <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8 px-4 sm:px-0 pb-12">
      {/* Back link */}
      {isManagerView && (
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link
            href={`/leads/performance?tab=${searchParams.get('tab') || 'all'}`}
            className="hover:text-amber-600 hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Team
          </Link>
        </div>
      )}

      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'h-14 w-14 rounded-full flex items-center justify-center text-xl font-semibold',
              getAvatarColors(user.name),
            )}
          >
            {getInitials(user.name)}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{user.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={cn(
                  'px-2 py-0.5 text-xs font-semibold rounded-md',
                  isQualifier
                    ? 'bg-blue-50 text-blue-700 border border-blue-100'
                    : 'bg-purple-50 text-purple-700 border border-purple-100',
                )}
              >
                {user.role.toUpperCase()}
              </span>
              <span className="text-sm text-gray-500">{user.location}</span>
            </div>
          </div>
        </div>

        {/* Date range filter */}
        <div className="w-full sm:w-48">
          <Select
            value={datePreset}
            onValueChange={(v) => setDatePreset(v as DatePreset)}
          >
            <SelectTrigger className="bg-white border-gray-200 text-gray-900 h-10 shadow-sm focus:ring-1 focus:ring-amber-500">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="last_7_days">Last 7 days</SelectItem>
              <SelectItem value="all_time">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-6">
        {/* ── LEADS section ─────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">
            LEADS
          </h2>

          {isQualifier ? (
            /* Qualifier: single Leads Added card + Edited Leads card */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-500">Leads Added</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-gray-900">
                      {totalLeadsCount.toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-amber-600">{rankLabel}</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-500">Edited Leads</p>
                    <PencilLine className="h-4 w-4 text-gray-300" />
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-gray-900">
                      {(editedLeads ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Leads edited — {dateRangeLabel}
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Onboarder: Claims + Leads Added + Edited Leads */
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-500">Claims</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-gray-900">
                      {(data.currentClaims || 0).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-amber-600">{rankLabel}</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-500">Leads Added</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-gray-900">
                      {totalLeadsCount.toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Includes transferred leads</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-500">Edited Leads</p>
                    <PencilLine className="h-4 w-4 text-gray-300" />
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-gray-900">
                      {(editedLeads ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Leads edited — {dateRangeLabel}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* ── FOLLOW-UPS — onboarder only ───────────────────────────────────── */}
        {!isQualifier && (
          <div>
            <h2 className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">
              FOLLOW-UPS
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-500">Total Follow-ups</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {followUps.total.toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card
                className={cn(
                  'bg-white border-gray-200 shadow-sm',
                  followUps.overdue > 0 ? 'border-rose-200 bg-rose-50/20' : '',
                )}
              >
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-500">Overdue Follow-ups</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span
                      className={cn(
                        'text-3xl font-bold',
                        followUps.overdue > 0 ? 'text-rose-600' : 'text-gray-900',
                      )}
                    >
                      {followUps.overdue.toLocaleString()}
                    </span>
                  </div>
                  {followUps.overdue > 0 && (
                    <p className="mt-1 text-xs font-medium text-rose-600">Needs attention</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-500">Follow-ups Due Today</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {followUps.dueToday.toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ── OUTCOMES — onboarder only ─────────────────────────────────────── */}
        {!isQualifier && (
          <div>
            <h2 className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">
              OUTCOMES
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-500">Interested</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-emerald-600">
                      {outcomes.interested.toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-500">Not Interested</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {outcomes.notInterested.toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-500">Not Registered</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {(outcomes.notRegistered ?? 0).toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-emerald-50/10 border-emerald-200 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-500">Registered</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-emerald-600">
                      {(outcomes.registered ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-emerald-600">
                    {conversionRate}% conv. rate
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-500">Registered &amp; Verified</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-amber-600">
                      {(outcomes.verified ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    of {(outcomes.totalRegistered ?? 0).toLocaleString()} registered
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
