'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { CheckCircle2, Download, Loader2, MapPin, RefreshCw, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { caosApi, type WebsiteLead } from '@/lib/api/caos';
import { SUPPORTED_CITIES } from '@/lib/places/supportedCities';

const PAGE_SIZE = 20;

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : format(date, 'dd MMM yyyy, h:mm a');
}

export default function WebsiteLeadsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { role, user, loading: authLoading } = useJWTAuth();
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  const canAccess =
    !authLoading && (role === 'onboarder' || role === 'lead_access_manager');
  const currentUserId =
    user?.userId ||
    (user && typeof user === 'object' && 'uid' in user && typeof user.uid === 'string'
      ? user.uid
      : undefined);

  useEffect(() => {
    if (!authLoading && !canAccess) {
      toast.error('You do not have permission to access website leads.');
      router.push('/leads');
    }
  }, [authLoading, canAccess, router]);

  const leadsQuery = useQuery({
    queryKey: ['website-leads', page, search, city],
    queryFn: () => caosApi.getWebsiteLeads({ page, limit: PAGE_SIZE, search, city }),
    enabled: canAccess,
  });

  const claimMutation = useMutation({
    mutationFn: (leadId: string) => caosApi.claimWebsiteLead(leadId),
    onSuccess: () => {
      toast.success('Website lead claimed successfully.');
      queryClient.invalidateQueries({ queryKey: ['website-leads'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Unable to claim this website lead.');
      queryClient.invalidateQueries({ queryKey: ['website-leads'] });
    },
  });

  const leads = leadsQuery.data?.data || [];
  const summary = leadsQuery.data?.summary;
  const totalPages = Math.max(1, leadsQuery.data?.pagination.pages || 1);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const firstPage = await caosApi.getWebsiteLeads({
        page: 1,
        limit: 100,
        search,
        city,
      });
      const allLeads = [...firstPage.data];

      for (let exportPage = 2; exportPage <= firstPage.pagination.pages; exportPage += 1) {
        const pageResult = await caosApi.getWebsiteLeads({
          page: exportPage,
          limit: 100,
          search,
          city,
        });
        allLeads.push(...pageResult.data);
      }

      const escapeCsvValue = (value: string) => {
        const safeValue = /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
        return `"${safeValue.replace(/"/g, '""')}"`;
      };
      const rows = [
        ['Name', 'Phone', 'City', 'Service', 'Created At'],
        ...allLeads.map((lead) => [
          lead.fullName || '',
          lead.mobileNumber || '',
          lead.city || '',
          lead.serviceCategory || '',
          formatCreatedAt(lead.createdAt),
        ]),
      ];
      const csv = `\uFEFF${rows.map((row) => row.map(escapeCsvValue).join(',')).join('\r\n')}`;
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `website-leads-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${allLeads.length} website leads`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to export website leads.');
    } finally {
      setIsExporting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-amber-600" aria-label="Loading" />
      </div>
    );
  }

  if (!canAccess) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Website Leads</h1>
          <p className="mt-1 text-sm text-gray-600">
            Partner enquiries submitted through the ExtraHand website and Google Ads.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => leadsQuery.refetch()}
          disabled={leadsQuery.isFetching}
          aria-label="Refresh website leads"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${leadsQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm text-gray-600">Total Enquiries</p>
              <p className="text-2xl font-bold text-gray-900">{summary?.total ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm text-gray-600">Claimed</p>
              <p className="text-2xl font-bold text-gray-900">{summary?.claimed ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                aria-label="Search by name or phone"
                className="pl-9"
                placeholder="Search by name or phone..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex min-w-0 gap-2">
              <Select
                value={city || 'all'}
                onValueChange={(value) => {
                  setCity(value === 'all' ? '' : value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="min-w-0 flex-1 sm:w-[200px] sm:flex-none" aria-label="Filter by city">
                  <MapPin className="mr-2 h-4 w-4 text-gray-400" />
                  <SelectValue placeholder="All Cities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {SUPPORTED_CITIES.map((cityName) => (
                    <SelectItem key={cityName} value={cityName}>{cityName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="shrink-0"
                variant="outline"
                onClick={handleExportCsv}
                disabled={isExporting}
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Export CSV'}
              </Button>
            </div>
          </div>

          {leadsQuery.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-center">
              <p className="text-sm font-medium text-red-800">
                {leadsQuery.error instanceof Error
                  ? leadsQuery.error.message
                  : 'Unable to load website leads.'}
              </p>
              <Button className="mt-3" variant="outline" onClick={() => leadsQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Phone</th>
                    <th className="px-4 py-3 font-semibold">City</th>
                    <th className="px-4 py-3 font-semibold">Service</th>
                    <th className="px-4 py-3 font-semibold">Created At</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leadsQuery.isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-amber-600" />
                        Loading website leads...
                      </td>
                    </tr>
                  ) : leads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                        No website enquiries found.
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead: WebsiteLead) => {
                      const isClaimedByMe = !!currentUserId && lead.claimedBy === currentUserId;
                      return (
                        <tr key={lead._id} className="hover:bg-amber-50/40">
                          <td className="px-4 py-3 font-medium text-gray-900">{lead.fullName}</td>
                          <td className="px-4 py-3">
                            <a className="text-gray-700 hover:text-amber-700" href={`tel:${lead.mobileNumber}`}>
                              {lead.mobileNumber}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{lead.city}</td>
                          <td className="px-4 py-3 text-gray-700">{lead.serviceCategory}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                            {formatCreatedAt(lead.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {lead.claimedAt ? (
                              <span className="text-xs font-medium text-green-700">
                                {isClaimedByMe ? 'Claimed by you' : `Claimed by ${lead.claimedByName || 'another user'}`}
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => claimMutation.mutate(lead._id)}
                                disabled={claimMutation.isPending}
                              >
                                {claimMutation.isPending && claimMutation.variables === lead._id
                                  ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                  : null}
                                Claim
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!leadsQuery.isError && (
            <div className="flex items-center justify-between gap-3 text-sm text-gray-600">
              <span>
                {leadsQuery.data?.pagination.total ?? 0} enquiries
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1 || leadsQuery.isFetching}
                >
                  Previous
                </Button>
                <span>Page {page} of {totalPages}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages || leadsQuery.isFetching}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
