'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { caosApi } from '@/lib/api/caos';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { useSessionStorage } from '@/lib/hooks/useSessionStorage';
import { Loader2, ArrowRight, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function PerformancePage() {
  const { role, loading } = useJWTAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isManagerView = role === 'lead_access_manager';

  const [activeTab, setActiveTab] = useSessionStorage<'all' | 'qualifier' | 'onboarder'>(
    'performance-activeTab',
    (searchParams.get('tab') as 'all' | 'qualifier' | 'onboarder') || 'all'
  );
  const [searchQuery, setSearchQuery] = useSessionStorage('performance-search', '');


  const { data: response, isLoading } = useQuery({
    queryKey: ['performance-overview'],
    queryFn: () => caosApi.getTeamPerformance(),
    enabled: isManagerView,
  });

  const data = response?.data;
  const kpis = data?.kpis;
  const users = data?.users || [];

  // Filter users list based on tab and search query
  const filteredUsers = useMemo(() => {
    return users.filter((user: any) => {
      const matchesTab = activeTab === 'all' || user.role === activeTab;
      const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [users, activeTab, searchQuery]);

  // Sort by claims descending
  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a: any, b: any) => (b.totalLeads || 0) - (a.totalLeads || 0));
  }, [filteredUsers]);

  // Calculate dynamic KPIs based on active tab
  const computedKpis = useMemo(() => {
    if (!kpis) {
      return {
        totalTeam: 0,
        totalLeads: 0,
        totalOverdue: 0,
        totalRegistered: 0,
        subText: '',
      };
    }

    if (activeTab === 'all') {
      return {
        totalTeam: kpis.totalTeam || 0,
        totalLeads: kpis.totalLeads || 0,
        totalOverdue: kpis.totalOverdue || 0,
        totalRegistered: kpis.totalRegistered || 0,
        subText: `${kpis.qualifiersCount || 0} qualifiers · ${kpis.onboardersCount || 0} onboarders`,
      };
    }

    const tabUsers = users.filter((u: any) => u.role === activeTab);
    const totalTeam = tabUsers.length;
    const totalLeads = tabUsers.reduce((sum: number, u: any) => sum + (u.totalLeads || 0), 0);
    const totalOverdue = tabUsers.reduce((sum: number, u: any) => sum + (u.overdue || 0), 0);
    const totalRegistered = activeTab === 'onboarder'
      ? (kpis.totalRegistered || 0)
      : 0;

    return {
      totalTeam,
      totalLeads,
      totalOverdue,
      totalRegistered,
      subText: activeTab === 'qualifier' ? 'Only Qualifiers' : 'Only Onboarders',
    };
  }, [activeTab, kpis, users]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isManagerView) {
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

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

  return (
    <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8 px-4 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Performance</h1>
        <p className="text-sm text-gray-500 mt-1">Track activity and outcomes for each team member</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'all' ? 'default' : 'outline'}
            onClick={() => { setActiveTab('all'); router.replace(`/leads/performance?tab=all`); }}
            className={cn(activeTab === 'all' ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600' : 'text-gray-700 border-gray-200')}
          >
            All
          </Button>
          <Button
            variant={activeTab === 'qualifier' ? 'default' : 'outline'}
            onClick={() => { setActiveTab('qualifier'); router.replace(`/leads/performance?tab=qualifier`); }}
            className={cn(activeTab === 'qualifier' ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600' : 'text-gray-700 border-gray-200')}
          >
            Qualifiers
          </Button>
          <Button
            variant={activeTab === 'onboarder' ? 'default' : 'outline'}
            onClick={() => { setActiveTab('onboarder'); router.replace(`/leads/performance?tab=onboarder`); }}
            className={cn(activeTab === 'onboarder' ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600' : 'text-gray-700 border-gray-200')}
          >
            Onboarders
          </Button>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search User..."
            className="pl-9 bg-white border-gray-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-500">Total Team</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">{computedKpis.totalTeam}</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {computedKpis.subText}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-500">Leads Added</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">{computedKpis.totalLeads.toLocaleString()}</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">Filtered by selected tab</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-500">
              {activeTab === 'all' ? 'Team Overdue Follow-ups' : 'Overdue Follow-ups'}
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={cn("text-3xl font-bold", computedKpis.totalOverdue > 0 ? "text-rose-600" : "text-emerald-600")}>
                {computedKpis.totalOverdue.toLocaleString()}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {activeTab === 'all'
                ? 'Across displayed team members'
                : computedKpis.totalOverdue > 0
                  ? 'Needs attention'
                  : 'On track'}
            </p>
          </CardContent>
        </Card>

        {activeTab !== 'qualifier' ? (
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-gray-500">Total Registered</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-emerald-600">{computedKpis.totalRegistered.toLocaleString()}</span>
              </div>
              <p className="mt-1 text-xs text-gray-400">Taskers registered on platform</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-gray-50/50 border-gray-200 shadow-sm border-dashed">
            <CardContent className="p-6 flex flex-col justify-center h-full min-h-[96px]">
              <p className="text-sm font-medium text-gray-400">Registered</p>
              <p className="text-xs text-gray-400 mt-2">Only applicable for onboarders</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {sortedUsers.map((user: any, index: number) => (
          <Card 
            key={user.userId} 
            className="bg-white border-gray-200 shadow-xs hover:bg-gray-50/50 transition-colors cursor-pointer"
            onClick={() => router.push(`/leads/performance/${user.userId}?tab=${activeTab}`)}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-400 w-6">#{index + 1}</span>
                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold", getAvatarColors(user.name))}>
                  {getInitials(user.name)}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{user.name}</h3>
                  <p className="text-xs text-gray-500 capitalize">
                    {user.role} · {user.location}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 sm:gap-10">
                <div className="hidden sm:block">
                  <span className={cn(
                    "px-2.5 py-1 text-xs font-semibold rounded-md",
                    user.role === 'qualifier' ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-purple-50 text-purple-700 border border-purple-100"
                  )}>
                    {user.role.toUpperCase()}
                  </span>
                </div>

                <div className="text-right min-w-[90px]">
                  {user.role === 'onboarder' ? (
                    <>
                      <p className="font-semibold text-gray-900">
                        {user.currentClaims || 0} <span className="text-xs text-gray-400 font-normal">/ {user.totalLeads || 0}</span>
                      </p>
                      <p className="text-xs text-gray-400">Claims / Leads Added</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-gray-900">{user.totalLeads || 0}</p>
                      <p className="text-xs text-gray-400">Leads Added</p>
                    </>
                  )}
                </div>

                {user.role === 'onboarder' && (
                  <>
                    <div className="text-right hidden md:block">
                      <p className="font-semibold text-gray-900">{user.followUps?.toLocaleString() || 0}</p>
                      <p className="text-xs text-gray-400">Follow-ups</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="font-semibold text-emerald-600">{user.registered?.toLocaleString() || 0}</p>
                      <p className="text-xs text-gray-400">Registered</p>
                    </div>
                  </>
                )}

                <div className="text-right min-w-[70px]">
                  {user.overdue > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 border border-rose-100">
                      {user.overdue} overdue follow-ups
                    </span>
                  ) : (
                    <div className="text-center">
                      <p className="font-semibold text-gray-400">-</p>
                      <p className="text-xs text-gray-400">Overdue Follow-ups</p>
                    </div>
                  )}
                </div>

                <ArrowRight className="h-4 w-4 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        ))}
        {sortedUsers.length === 0 && (
          <div className="py-12 text-center text-gray-500 bg-white rounded-lg border border-gray-200">
            No team members found matching the filters.
          </div>
        )}
      </div>
    </div>
  );
}
