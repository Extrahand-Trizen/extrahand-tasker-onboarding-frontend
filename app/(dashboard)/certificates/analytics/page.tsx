'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { certificateReviewApi } from '@/lib/api/certificateReview';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { BarChart3, RefreshCw } from 'lucide-react';
import { subDays, format } from 'date-fns';

function toInputDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export default function CertificateAnalyticsPage() {
  const { role, loading: authLoading } = useJWTAuth();
  const canAccess = role === 'lead_access_manager';

  const defaultTo = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => subDays(defaultTo, 30), [defaultTo]);

  const [fromStr, setFromStr] = useState(() => toInputDate(defaultFrom));
  const [toStr, setToStr] = useState(() => toInputDate(defaultTo));
  const [appliedRange, setAppliedRange] = useState({ from: fromStr, to: toStr });

  const query = useQuery({
    queryKey: ['certificate-analytics', appliedRange.from, appliedRange.to],
    queryFn: () =>
      certificateReviewApi.getAnalytics({
        from: new Date(appliedRange.from).toISOString(),
        to: new Date(appliedRange.to + 'T23:59:59.999Z').toISOString(),
      }),
    enabled: canAccess && !authLoading,
  });

  const data = query.data?.data;

  const applyRange = () => {
    setAppliedRange({ from: fromStr, to: toStr });
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-amber-500 border-r-transparent" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="space-y-4 px-4 sm:px-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Certificate analytics</h1>
        <p className="text-sm text-gray-500">
          This page is restricted to Lead Access Manager. Onboarders and support can use Certificate
          Verification only.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-amber-600" />
            Certificate analytics
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">
            Review volume, reviewer activity, queue time, and rejection reasons. Period filters apply to
            decisions (verify/reject); pending count is a current snapshot.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${query.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex flex-wrap items-end gap-3 sm:gap-4">
            <div>
              <Label className="text-xs text-gray-600">From</Label>
              <input
                type="date"
                value={fromStr}
                onChange={(e) => setFromStr(e.target.value)}
                className="mt-1 block h-10 rounded-md border border-gray-300 px-3 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">To</Label>
              <input
                type="date"
                value={toStr}
                onChange={(e) => setToStr(e.target.value)}
                className="mt-1 block h-10 rounded-md border border-gray-300 px-3 text-sm"
              />
            </div>
            <Button type="button" onClick={applyRange} className="bg-amber-600 hover:bg-amber-700 text-white">
              Apply range
            </Button>
          </div>
          {data?.period ? (
            <p className="text-xs text-gray-500 mt-3">
              Reporting window (server): {new Date(data.period.from).toLocaleString()} —{' '}
              {new Date(data.period.to).toLocaleString()}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {query.isError ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 text-sm text-red-800">
            {(query.error as Error)?.message || 'Failed to load analytics'}
          </CardContent>
        </Card>
      ) : null}

      {query.isLoading ? (
        <div className="flex justify-center py-12 text-gray-500 text-sm">Loading analytics…</div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="border-gray-200 shadow-sm">
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending (now)</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{data.snapshot.pendingCount}</p>
              </CardContent>
            </Card>
            <Card className="border-gray-200 shadow-sm">
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Verified (period)</p>
                <p className="text-2xl font-bold text-green-700 mt-1">{data.decisionsInPeriod.verified}</p>
              </CardContent>
            </Card>
            <Card className="border-gray-200 shadow-sm">
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Rejected (period)</p>
                <p className="text-2xl font-bold text-red-700 mt-1">{data.decisionsInPeriod.rejected}</p>
              </CardContent>
            </Card>
            <Card className="border-gray-200 shadow-sm">
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reject rate</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {data.decisionsInPeriod.rejectRate != null ? `${data.decisionsInPeriod.rejectRate}%` : '—'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Of decisions in period</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="border-gray-200 shadow-sm">
              <CardContent className="pt-4">
                <p className="text-sm font-semibold text-gray-900">Queue time (upload → decision)</p>
                <p className="text-xs text-gray-500 mt-1">
                  Median uses a random sample on large datasets; average uses all matching rows (
                  {data.queueTimeHours.sampleSize} rows with valid upload + review times).
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Median</span>
                    <p className="font-semibold text-gray-900">
                      {data.queueTimeHours.median != null ? `${data.queueTimeHours.median} h` : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Average</span>
                    <p className="font-semibold text-gray-900">
                      {data.queueTimeHours.average != null ? `${data.queueTimeHours.average} h` : '—'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-gray-200 shadow-sm">
              <CardContent className="pt-4">
                <p className="text-sm font-semibold text-gray-900">Top rejection reasons</p>
                {data.topRejectionReasons.length === 0 ? (
                  <p className="text-sm text-gray-500 mt-2">No rejections in this period.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {data.topRejectionReasons.map((r) => (
                      <li key={r.reason} className="flex justify-between gap-2 border-b border-gray-100 pb-1">
                        <span className="text-gray-800 wrap-break-word">{r.reason}</span>
                        <span className="font-medium text-gray-900 shrink-0">{r.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-gray-200 shadow-sm">
            <CardContent className="pt-4 sm:pt-6">
              <p className="text-sm font-semibold text-gray-900 mb-4">Decisions per day (IST)</p>
              {data.daily.length === 0 ? (
                <p className="text-sm text-gray-500">No decisions in the selected range.</p>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="verified" name="Verified" stroke="#15803d" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="rejected" name="Rejected" stroke="#b91c1c" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-sm">
            <CardContent className="pt-4 sm:pt-6 overflow-x-auto">
              <p className="text-sm font-semibold text-gray-900 mb-4">By reviewer</p>
              {data.byReviewer.length === 0 ? (
                <p className="text-sm text-gray-500">No reviews in this period.</p>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Reviewer ID</th>
                      <th className="py-2 pr-3">Verified</th>
                      <th className="py-2 pr-3">Rejected</th>
                      <th className="py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byReviewer.map((row, idx) => (
                      <tr key={`${row.reviewerKey}-${idx}`} className="border-b border-gray-100">
                        <td className="py-2 pr-3 font-medium text-gray-900">
                          {row.reviewerDisplayName || '—'}
                        </td>
                        <td className="py-2 pr-3 text-gray-700 break-all max-w-[200px]">{row.reviewerKey}</td>
                        <td className="py-2 pr-3 text-green-700">{row.verified}</td>
                        <td className="py-2 pr-3 text-red-700">{row.rejected}</td>
                        <td className="py-2 font-semibold">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
