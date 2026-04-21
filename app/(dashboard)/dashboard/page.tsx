"use client";

import { useQuery, useQueries } from "@tanstack/react-query";
import { caosApi } from "@/lib/api/caos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, Heart, UserX, UserCheck, ShieldCheck, UserMinus, PhoneCall, AlertTriangle, CalendarClock } from "lucide-react";
import { useJWTAuth } from "@/lib/hooks/useJWTAuth";

export default function DashboardPage() {
  const { role, user } = useJWTAuth();

  const { data: leadsData, isLoading } = useQuery({
    queryKey: ["leads", "dashboard", role, user?.userId],
    queryFn: () =>
      caosApi.searchLeads({
        limit: 1,
        addedBy: role === "qualifier" ? user?.userId : undefined,
      }),
    enabled: role !== "qualifier" || !!user?.userId,
  });

  const { data: approvedData } = useQuery({
    queryKey: ["leads", "dashboard", "approved"],
    queryFn: () => caosApi.searchLeads({ status: "approved", limit: 1 }),
    enabled: role !== "qualifier",
  });
  const { data: followUpStatsData } = useQuery({
    queryKey: ["leads", "dashboard", "callback-stats"],
    queryFn: () => caosApi.getFollowUpQueueStats(),
  });
  const { data: dashboardMetricsData } = useQuery({
    queryKey: ["leads", "dashboard", "metrics"],
    queryFn: () => caosApi.getDashboardMetrics(),
    enabled: role !== "qualifier",
  });

  const isOnboarderOrManager = role === "onboarder" || role === "lead_access_manager";

  // Counts only for onboarder & lead_access_manager (enabled: false for other roles)
  const countQueries = useQueries({
    queries: [
      { queryKey: ["interested-count", role], queryFn: () => caosApi.getInterestedCandidates({ page: 1, limit: 1 }), staleTime: 60_000, enabled: !!role },
      { queryKey: ["not-interested-count", role], queryFn: () => caosApi.getNotInterestedCandidates({ page: 1, limit: 1 }), staleTime: 60_000, enabled: !!role },
      { queryKey: ["count-not-registered", isOnboarderOrManager], queryFn: () => caosApi.searchLeads({ registrationStatus: "not_registered", page: 1, limit: 1 }), staleTime: 60_000, enabled: isOnboarderOrManager },
      { queryKey: ["count-registered", isOnboarderOrManager], queryFn: () => caosApi.searchLeads({ registrationStatus: "registered", page: 1, limit: 1 }), staleTime: 60_000, enabled: isOnboarderOrManager },
      { queryKey: ["count-registered-verified", isOnboarderOrManager], queryFn: () => caosApi.searchLeads({ registrationStatus: "registered_verified", page: 1, limit: 1 }), staleTime: 60_000, enabled: isOnboarderOrManager },
    ],
  });

  const stats = {
    total: leadsData?.pagination?.total ?? 0,
    approved: approvedData?.pagination?.total ?? 0,
  };

  const interestedTotal = countQueries[0]?.data?.data?.total ?? 0;
  const notInterestedTotal = countQueries[1]?.data?.data?.total ?? 0;
  const notRegisteredTotal = countQueries[2]?.data?.pagination?.total ?? 0;
  const registeredTotal = countQueries[3]?.data?.pagination?.total ?? 0;
  const registeredVerifiedTotal = countQueries[4]?.data?.pagination?.total ?? 0;
  const taskersAadhaarVerifiedTotal = dashboardMetricsData?.data?.taskersAadhaarVerified ?? 0;
  const statCards =
    role === "qualifier"
      ? [
          { title: "My Leads", value: stats.total, icon: Users, color: "text-amber-600", bg: "bg-amber-50" },
          { title: "Interested Candidates", value: interestedTotal, icon: Heart, color: "text-yellow-600", bg: "bg-yellow-50" },
          { title: "Not Interested Candidates", value: notInterestedTotal, icon: UserX, color: "text-blue-600", bg: "bg-blue-50" },
          { title: "My Total Follow-ups", value: followUpStatsData?.data?.totalFollowUps ?? 0, icon: CalendarClock, color: "text-cyan-700", bg: "bg-cyan-50" },
          {
            title: "My Overdue Follow-ups",
            value: (followUpStatsData?.data?.callbackOverdue ?? 0) + (followUpStatsData?.data?.onboardingOverdue ?? 0),
            icon: AlertTriangle,
            color: "text-red-600",
            bg: "bg-red-50",
          },
          {
            title: "My Follow-ups Due Today",
            value: (followUpStatsData?.data?.callbackDueToday ?? 0) + (followUpStatsData?.data?.onboardingDueToday ?? 0),
            icon: PhoneCall,
            color: "text-indigo-600",
            bg: "bg-indigo-50",
          },
        ]
      : [
          { title: "Total Leads", value: stats.total, icon: Users, color: "text-amber-600", bg: "bg-amber-50" },
          { title: "Ready to Invite", value: stats.approved, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
          { title: "Total Follow-ups", value: followUpStatsData?.data?.totalFollowUps ?? 0, icon: CalendarClock, color: "text-cyan-700", bg: "bg-cyan-50" },
          {
            title: "Overdue Follow-ups",
            value: (followUpStatsData?.data?.callbackOverdue ?? 0) + (followUpStatsData?.data?.onboardingOverdue ?? 0),
            icon: AlertTriangle,
            color: "text-red-600",
            bg: "bg-red-50",
          },
          {
            title: "Follow-ups Due Today",
            value: (followUpStatsData?.data?.callbackDueToday ?? 0) + (followUpStatsData?.data?.onboardingDueToday ?? 0),
            icon: PhoneCall,
            color: "text-indigo-600",
            bg: "bg-indigo-50",
          },
          ...(isOnboarderOrManager
            ? [
                { title: "Interested Candidates", value: interestedTotal, icon: Heart, color: "text-yellow-600", bg: "bg-yellow-50" },
                { title: "Not Interested Candidates", value: notInterestedTotal, icon: UserX, color: "text-blue-600", bg: "bg-blue-50" },
                { title: "Not Registered", value: notRegisteredTotal, icon: UserMinus, color: "text-gray-600", bg: "bg-gray-100" },
                { title: "Registered", value: registeredTotal, icon: UserCheck, color: "text-amber-600", bg: "bg-amber-50" },
                { title: "Registered & Verified", value: registeredVerifiedTotal, icon: ShieldCheck, color: "text-green-600", bg: "bg-green-50" },
                { title: "Taskers Aadhaar Verified", value: taskersAadhaarVerifiedTotal, icon: ShieldCheck, color: "text-emerald-700", bg: "bg-emerald-50" },
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

      {isLoading ? (
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
          {statCards.map((stat) => (
            <Card
              key={stat.title}
              className="border-gray-200 shadow-sm hover:shadow-md transition-shadow"
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
                <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {stat.value.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
