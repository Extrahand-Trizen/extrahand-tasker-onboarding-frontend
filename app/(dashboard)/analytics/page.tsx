'use client';

import { useQuery } from '@tanstack/react-query';
import { caosApi } from '@/lib/api/caos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart3 } from 'lucide-react';
import { leadStatusLabel } from '@/lib/leadLabels';

type CountRow = { label: string; count: number };

function StatList({ title, items }: { title: string; items: CountRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-gray-600">No data</p>
        ) : (
          <div className="space-y-2">
            {items.map((row) => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-gray-800">{row.label || 'Unknown'}</span>
                <Badge className="bg-gray-100 text-gray-800">{row.count}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['caos-analytics'],
    queryFn: () => caosApi.getAnalytics(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const analytics = data?.data;

  const statusRows: CountRow[] =
    analytics?.statusCounts.map((s) => ({ label: leadStatusLabel(s.status), count: s.count })) || [];
  const sourceRows: CountRow[] =
    analytics?.sourceCounts.map((s) => ({ label: s.source, count: s.count })) || [];
  const cityRows: CountRow[] =
    analytics?.cityCounts.map((c) => ({ label: c.city, count: c.count })) || [];
  const skillRows: CountRow[] =
    analytics?.skillCounts.map((s) => ({ label: s.primarySkill, count: s.count })) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1.5">Lead statistics and breakdowns</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatList title="By Status" items={statusRows} />
        <StatList title="By Source" items={sourceRows} />
        <StatList title="Top Cities" items={cityRows} />
        <StatList title="Top Skills" items={skillRows} />
      </div>
    </div>
  );
}

