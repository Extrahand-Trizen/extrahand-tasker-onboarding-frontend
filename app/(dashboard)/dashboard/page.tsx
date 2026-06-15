"use client";

import { keepPreviousData, useQuery, useQueries } from "@tanstack/react-query";
import { caosApi } from "@/lib/api/caos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, Heart, UserX, UserCheck, ShieldCheck, UserMinus, PhoneCall, AlertTriangle, CalendarClock } from "lucide-react";
import { useJWTAuth } from "@/lib/hooks/useJWTAuth";
import Link from "next/link";

export default function DashboardPage() {
  const { role, user, loading: authLoading } = useJWTAuth();
  const currentUserId =
    user?.userId ||
    (user && typeof user === "object" && "uid" in user && typeof user.uid === "string"
      ? user.uid
      : undefined);
  const isQualifier = role === "qualifier";
  const isReady = !!role && (!isQualifier || !!currentUserId);

  const { data: leadsData, isLoading } = useQuery({
    queryKey: ["leads", "dashboard", role, currentUserId],
    queryFn: () =>
      caosApi.searchLeads({
        limit: 500,
        addedBy: isQualifier ? currentUserId : undefined,
        pickedBy: role === "onboarder" ? currentUserId : undefined,
      }),
    enabled: isReady,
  });

  const { data: myLeadsData } = useQuery({
    queryKey: ["leads", "dashboard", "my-leads", currentUserId],
    queryFn: () =>
      caosApi.searchLeads({
        limit: 1,
        addedBy: currentUserId,
      }),
    enabled: role === "onboarder" && !!currentUserId,
  });

  const { data: approvedData } = useQuery({
    queryKey: ["leads", "dashboard", "approved", role, currentUserId],
    queryFn: () => caosApi.searchLeads({
      status: "approved",
      limit: 1,
      pickedBy: role === "onboarder" ? currentUserId : undefined,
    }),
    enabled: !!role && role !== "qualifier",
  });
  const { data: followUpStatsData, isError: followUpStatsError } = useQuery({
    queryKey: ["leads", "dashboard", "callback-stats", role, currentUserId],
    queryFn: () => caosApi.getFollowUpQueueStats({
      addedBy: role === "qualifier" ? currentUserId : undefined,
      ownerBy: role === "onboarder" ? currentUserId : undefined,
    }),
    enabled: isReady,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    retry: 2,
  });

  const isOnboarderOrManager = role === "onboarder" || role === "lead_access_manager";
  const canViewRegistrationMetrics = isOnboarderOrManager || (isQualifier && !!currentUserId);
  /** Onboarder: owner scope for not-registered / verified cards (broader). */
  const registrationScopeOwner =
    role === "onboarder" && currentUserId
      ? { ownerBy: currentUserId }
      : {
          addedBy: isQualifier ? currentUserId : undefined,
          pickedBy: role === "onboarder" ? currentUserId : undefined,
        };
  /** Registered card only: claimed (pickedBy) + registered on platform, not Aadhaar-verified. */
  const registrationScopeRegisteredCard =
    role === "onboarder" && currentUserId
      ? { pickedBy: currentUserId }
      : registrationScopeOwner;

  // Registration metrics are shown for onboarder/manager and qualifier.
  const countQueries = useQueries({
    queries: [
      {
        queryKey: ["leads", "counts", "interested", role, currentUserId],
        queryFn: () =>
          caosApi.searchLeads({
            status: "contacted_interested",
            page: 1,
            limit: 1,
            addedBy: isQualifier ? currentUserId : undefined,
            pickedBy: role === "onboarder" ? currentUserId : undefined,
          }),
        staleTime: 60_000,
        enabled: isReady,
      },
      {
        queryKey: ["leads", "counts", "not-interested", role, currentUserId],
        queryFn: () =>
          caosApi.searchLeads({
            status: "contacted_not_interested",
            page: 1,
            limit: 1,
            addedBy: isQualifier ? currentUserId : undefined,
            pickedBy: role === "onboarder" ? currentUserId : undefined,
          }),
        staleTime: 60_000,
        enabled: isReady,
      },
      {
        queryKey: ["leads", "counts", "not-registered", role, currentUserId],
        queryFn: () =>
          caosApi.searchLeads({
            registrationStatus: "not_registered",
            ...registrationScopeOwner,
            page: 1,
            limit: 1,
          }),
        staleTime: 60_000,
        enabled: canViewRegistrationMetrics,
      },
      {
        queryKey: ["leads", "counts", "registered", role, currentUserId],
        queryFn: () =>
          caosApi.searchLeads({
            registrationStatus: "registered",
            ...registrationScopeRegisteredCard,
            page: 1,
            limit: 1,
          }),
        staleTime: 60_000,
        enabled: canViewRegistrationMetrics,
      },
      {
        queryKey: ["leads", "counts", "registered-verified", role, currentUserId],
        queryFn: () =>
          caosApi.searchLeads({
            registrationStatus: "registered_verified",
            ...registrationScopeOwner,
            page: 1,
            limit: 1,
          }),
        staleTime: 60_000,
        enabled: canViewRegistrationMetrics,
      },
    ],
  });

  const stats = {
    total: leadsData?.pagination?.total ?? 0,
    approved: approvedData?.pagination?.total ?? 0,
  };

  const myLeadsTotal = myLeadsData?.pagination?.total ?? 0;

  const interestedTotal = countQueries[0]?.data?.pagination?.total ?? 0;
  const notInterestedTotal = countQueries[1]?.data?.pagination?.total ?? 0;
  const notRegisteredTotal = countQueries[2]?.data?.pagination?.total ?? 0;
  const registeredTotal = countQueries[3]?.data?.pagination?.total ?? 0;
  const registeredVerifiedTotal = countQueries[4]?.data?.pagination?.total ?? 0;
  const followUpStats = followUpStatsData?.data;
  const followUpAvailable = !!followUpStats && !followUpStatsError;
  const onboarderCurrentTotalLabel = `${stats.total} / ${myLeadsTotal}`;

  const statCards =
    role === "qualifier"
      ? [
          { title: "My Leads", value: stats.total, icon: Users, color: "text-amber-600", bg: "bg-amber-50", href: "/leads" },
          { title: "Interested Candidates", value: interestedTotal, icon: Heart, color: "text-yellow-600", bg: "bg-yellow-50", href: "/leads/interested" },
          { title: "Registered", value: registeredTotal, icon: UserCheck, color: "text-amber-600", bg: "bg-amber-50", href: "/leads/registered" },
          { title: "Registered & Verified", value: registeredVerifiedTotal, icon: ShieldCheck, color: "text-green-600", bg: "bg-green-50", href: "/leads/registered" },
        ]
      : [
          ...(role === "onboarder"
            ? [{
                title: "Current / Leads Added",
                value: null,
                displayValue: onboarderCurrentTotalLabel,
                icon: Users,
                color: "text-amber-600",
                bg: "bg-amber-50",
                href: "/leads/picks",
                subtitle: "Claims / leads you added",
              }]
            : [{
                title: role === "lead_access_manager" ? "All Leads" : "My Claims",
                value: stats.total,
                icon: Users,
                color: "text-amber-600",
                bg: "bg-amber-50",
                href: role === "lead_access_manager" ? "/leads/all" : "/leads/picks",
              }]),
          { title: "Total Follow-ups", value: followUpAvailable ? (followUpStats?.totalFollowUps ?? 0) : null, icon: CalendarClock, color: "text-cyan-700", bg: "bg-cyan-50", href: "/leads/callbacks" },
          {
            title: "Overdue Follow-ups",
            value: followUpAvailable
              ? (followUpStats?.callbackOverdue ?? 0) + (followUpStats?.onboardingOverdue ?? 0)
              : null,
            icon: AlertTriangle,
            color: "text-red-600",
            bg: "bg-red-50",
            href: "/leads/callbacks",
          },
          {
            title: "Follow-ups Due Today",
            value: followUpAvailable
              ? (followUpStats?.callbackDueToday ?? 0) + (followUpStats?.onboardingDueToday ?? 0)
              : null,
            icon: PhoneCall,
            color: "text-indigo-600",
            bg: "bg-indigo-50",
            href: "/leads/callbacks",
          },
          ...(isOnboarderOrManager
            ? [
                { title: "Interested Candidates", value: interestedTotal, icon: Heart, color: "text-yellow-600", bg: "bg-yellow-50", href: "/leads/interested" },
                { title: "Not Interested Candidates", value: notInterestedTotal, icon: UserX, color: "text-blue-600", bg: "bg-blue-50", href: "/leads/not-interested" },
                { title: "Not Registered", value: notRegisteredTotal, icon: UserMinus, color: "text-gray-600", bg: "bg-gray-100" },
                {
                  title: "Registered",
                  value: registeredTotal,
                  icon: UserCheck,
                  color: "text-emerald-600",
                  bg: "bg-emerald-50",
                  href: "/leads/registered",
                 
                },
                { title: "Registered & Verified", value: registeredVerifiedTotal, icon: ShieldCheck, color: "text-green-600", bg: "bg-green-50", href: "/leads/registered" },
              ]
            : []),
        ];

  return (
    <div className="space-y-6 sm:space-y-8 px-4 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Dashboard
        </h1>
        <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm text-gray-500">
          Overview of your leads and onboarding progress
        </p>
      </div>

      {authLoading || !isReady || isLoading ? (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="animate-pulse border-gray-200">
              <CardHeader>
                <div className="h-4 w-32 bg-gray-200 rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-20 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {statCards.map((stat) => {
            const card = (
              <Card
                key={stat.title}
                className={`border-gray-200 shadow-sm hover:shadow-md transition-shadow ${stat.href ? "cursor-pointer" : ""}`}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-700">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl sm:text-3xl font-bold ${stat.color?.includes('emerald') ? 'text-emerald-600' : 'text-gray-900'}`}>
                    {'displayValue' in stat && stat.displayValue
                      ? stat.displayValue
                      : stat.value === null
                        ? '—'
                        : typeof stat.value === 'number'
                          ? stat.value.toLocaleString()
                          : String(stat.value)}
                  </div>
                  {'subtitle' in stat && stat.subtitle ? (
                    <p className="mt-1 text-xs text-gray-400">{stat.subtitle}</p>
                  ) : null}
                </CardContent>
              </Card>
            );

            return stat.href ? (
              <Link key={stat.title} href={stat.href}>
                {card}
              </Link>
            ) : (
              card
            );
          })}
        </div>
      )}
    </div>
  );
}
