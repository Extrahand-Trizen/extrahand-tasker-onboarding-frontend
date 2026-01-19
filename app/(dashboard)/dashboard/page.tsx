"use client";

import { useQuery } from "@tanstack/react-query";
import { caosApi } from "@/lib/api/caos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserPlus, CheckCircle } from "lucide-react";
import { useJWTAuth } from "@/lib/hooks/useJWTAuth";

export default function DashboardPage() {
  const { data: leadsData, isLoading } = useQuery({
    queryKey: ["leads", "dashboard"],
    queryFn: () => caosApi.searchLeads({ limit: 100 }),
  });

  const { role } = useJWTAuth();

  const stats = {
    total: leadsData?.pagination.total || 0,
    approved:
      leadsData?.data.filter((l) => l.status === "approved").length || 0,
    // ✅ UPDATED: Check accountStatus instead of lead status
    activated:
      leadsData?.data.filter(
        (l) => l.accountStatus === "activated" || l.activationData?.firebaseUid,
      ).length || 0,
  };

  const statCards =
    role === "qualifier"
      ? [
          {
            title: "My Leads",
            value: stats.total,
            icon: Users,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
        ]
      : [
          {
            title: "Total Leads",
            value: stats.total,
            icon: Users,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
          {
            title: "Ready to Invite",
            value: stats.approved,
            icon: CheckCircle,
            color: "text-green-600",
            bg: "bg-green-50",
          },
          {
            title: "Accounts Created",
            value: stats.activated,
            icon: UserPlus,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
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
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
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
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
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
