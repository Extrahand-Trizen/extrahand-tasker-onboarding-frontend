'use client';

import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { caosApi, type StatusReportCategory } from '@/lib/api/caos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { PRIMARY_CATEGORY_OPTIONS, primaryCategoryLabel } from '@/lib/leadLabels';
import { Loader2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

type ExportTemplate = 'eod' | 'detailed';
type DatePreset = 'today' | 'last_7_days' | 'all_time' | 'custom';

const REPORT_CATEGORY_OPTIONS: Array<{ label: string; value: StatusReportCategory }> = [
  { label: 'Claims', value: 'touched_leads' },
  { label: 'Interested', value: 'interested' },
  { label: 'Callback Scheduled', value: 'callback_scheduled' },
  { label: 'Callback Overdue', value: 'callback_overdue' },
];

function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateRangeFromPreset(preset: Exclude<DatePreset, 'custom' | 'all_time'>): { from: string; to: string } {
  const today = new Date();
  const to = formatDateInputValue(today);

  if (preset === 'today') {
    return { from: to, to };
  }

  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 6);
  return { from: formatDateInputValue(fromDate), to };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export default function LeadReportsPage() {
  const { role, user, loading } = useJWTAuth();
  const isManagerView = role === 'lead_access_manager';
  const isQualifier = role === 'qualifier';
  const currentUserId =
    user?.userId ||
    (user && typeof user === 'object' && 'uid' in user && typeof user.uid === 'string'
      ? user.uid
      : undefined);

  const [datePreset, setDatePreset] = useState<DatePreset>('last_7_days');
  const [fromDate, setFromDate] = useState(getDateRangeFromPreset('last_7_days').from);
  const [toDate, setToDate] = useState(getDateRangeFromPreset('last_7_days').to);
  const [claimsScope, setClaimsScope] = useState<'current' | 'total'>('current');
  const [qualifierId, setQualifierId] = useState<string>('all');
  const [template, setTemplate] = useState<ExportTemplate>('eod');
  const [reportCategory, setReportCategory] = useState<StatusReportCategory>('touched_leads');
  const [downloadCategory, setDownloadCategory] = useState<string>('all');
  const [includeNotes, setIncludeNotes] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [gatedCommunityFilter, setGatedCommunityFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [localityFilter, setLocalityFilter] = useState<string>('all');
  const [localAreaFilter, setLocalAreaFilter] = useState<string>('all');

  useEffect(() => {
    if (role === 'onboarder' || role === 'lead_access_manager') {
      setReportCategory('touched_leads');
    } else {
      setReportCategory('interested');
    }
  }, [role]);

  const filteredReportCategoryOptions = useMemo(() => {
    return REPORT_CATEGORY_OPTIONS.map((option) => {
      if (option.value === 'touched_leads') {
        return {
          ...option,
          label: role === 'onboarder' ? 'Claims' : 'Leads Added',
        };
      }
      return option;
    });
  }, [role]);

  const isScopedUser = role === 'qualifier' || role === 'onboarder';
  const analyticsReady = isManagerView || (isScopedUser ? !!currentUserId : true);

  const analyticsQuery = useQuery({
    queryKey: ['status-analytics', fromDate, toDate, qualifierId, currentUserId, role, downloadCategory, datePreset, claimsScope, gatedCommunityFilter, cityFilter, localityFilter, localAreaFilter],
    queryFn: () =>
      caosApi.getStatusAnalytics({
        from: datePreset !== 'all_time' && fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
        to: datePreset !== 'all_time' && toDate ? `${toDate}T23:59:59.999Z` : undefined,
        allTime: datePreset === 'all_time',
        claimsScope: role === 'onboarder' ? claimsScope : undefined,
        qualifierId: isManagerView
          ? (qualifierId !== 'all' ? qualifierId : undefined)
          : role === 'qualifier'
            ? currentUserId
            : undefined,
        pickedBy: role === 'onboarder' ? currentUserId : undefined,
        category: downloadCategory !== 'all' ? downloadCategory : undefined,
        gatedCommunityName: gatedCommunityFilter !== 'all' ? gatedCommunityFilter : undefined,
        city: cityFilter !== 'all' ? cityFilter : undefined,
        locality: localityFilter !== 'all' ? localityFilter : undefined,
        localArea: localAreaFilter !== 'all' ? localAreaFilter : undefined,
      }),
    enabled: analyticsReady,
  });

  const creatorsQuery = useQuery({
    queryKey: ['qualifiers'],
    queryFn: () => caosApi.getQualifiers(),
    enabled: isManagerView,
  });

  const gatedCommunityNamesQuery = useQuery({
    queryKey: ['gated-community-names'],
    queryFn: () => caosApi.getGatedCommunityNames(),
    staleTime: 5 * 60 * 1000,
  });
  const gatedCommunityNames: string[] = gatedCommunityNamesQuery.data?.data || [];

  const locationFiltersQuery = useQuery({
    queryKey: ['lead-location-filter-options'],
    queryFn: () => caosApi.getLeadLocationFilterOptions(),
    staleTime: 5 * 60 * 1000,
  });
  const cityOptions = locationFiltersQuery.data?.data?.cities || [];
  const localityOptions = locationFiltersQuery.data?.data?.localities || [];
  const localAreaOptions = locationFiltersQuery.data?.data?.localAreas || [];

  const cards = useMemo(() => {
    const data = analyticsQuery.data?.data;
    if (isQualifier) {
      return [{ label: 'Leads Added', value: data?.leadsAdded ?? 0 }];
    }
    const base = [
      ...(role === 'onboarder' ? [{ label: 'Claims', value: data?.touchedLeads ?? 0 }] : []),
      { label: 'Interested', value: data?.interested ?? 0 },
      { label: 'Not Interested', value: data?.notInterested ?? 0 },
      { label: 'Callback Scheduled', value: data?.callbackScheduled ?? 0 },
      { label: 'Callback Overdue', value: data?.callbackOverdue ?? 0 },
      { label: 'Onboarded', value: data?.onboarded ?? 0 },
    ];

    if (isManagerView) {
      return [{ label: 'Leads Added', value: data?.leadsAdded ?? 0 }, ...base];
    }

    return base;
  }, [analyticsQuery.data, isQualifier, isManagerView, role]);

  const categoryBreakdownList = useMemo(() => {
    const rawBreakdown = analyticsQuery.data?.data?.categoryBreakdown || [];
    return rawBreakdown
      .filter((item) => item.count > 0)
      .map((item) => ({
        categoryKey: item.category,
        categoryName: primaryCategoryLabel(item.category),
        count: item.count,
      }));
  }, [analyticsQuery.data?.data?.categoryBreakdown]);

  const handleDownload = async (format: 'csv' | 'xlsx') => {
    setDownloading(true);
    try {
      const report = await caosApi.downloadStatusReport({
        format,
        template,
        reportCategory: isQualifier ? undefined : reportCategory,
        from: datePreset !== 'all_time' && fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
        to: datePreset !== 'all_time' && toDate ? `${toDate}T23:59:59.999Z` : undefined,
        allTime: datePreset === 'all_time',
        claimsScope: role === 'onboarder' ? claimsScope : undefined,
        qualifierId: isManagerView
          ? (qualifierId !== 'all' ? qualifierId : undefined)
          : role === 'qualifier'
            ? currentUserId
            : undefined,
        pickedBy: role === 'onboarder' ? currentUserId : undefined,
        includeNotes: isQualifier ? false : includeNotes,
        category: downloadCategory !== 'all' ? downloadCategory : undefined,
        exportLayout: isQualifier ? 'qualifier' : 'standard',
        gatedCommunityName: gatedCommunityFilter !== 'all' ? gatedCommunityFilter : undefined,
        city: cityFilter !== 'all' ? cityFilter : undefined,
        locality: localityFilter !== 'all' ? localityFilter : undefined,
        localArea: localAreaFilter !== 'all' ? localAreaFilter : undefined,
      });
      triggerDownload(report.blob, report.filename);
    } finally {
      setDownloading(false);
    }
  };

  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === 'custom') return;
    if (preset === 'all_time') {
      setFromDate('');
      setToDate('');
      return;
    }
    const range = getDateRangeFromPreset(preset);
    setFromDate(range.from);
    setToDate(range.to);
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 px-4 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Lead Status Reports</h1>
        <p className="mt-1 text-sm text-gray-500">Analytics and exports for contact-tracking progress</p>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardContent className="pt-6">
          <div
            className={cn(
              'grid grid-cols-1 sm:grid-cols-2 gap-4',
              isManagerView && 'lg:grid-cols-4 xl:grid-cols-8',
              isQualifier && 'lg:grid-cols-3 xl:grid-cols-6',
              role === 'onboarder' && 'lg:grid-cols-4 xl:grid-cols-8'
            )}
          >
            <div>
              <Label>Date Range</Label>
              <Select value={datePreset} onValueChange={(value) => handleDatePresetChange(value as DatePreset)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="last_7_days">Last Week (7 days)</SelectItem>
                  <SelectItem value="all_time">All Time</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="from-date">From</Label>
              <Input
                id="from-date"
                type="date"
                value={fromDate}
                disabled={datePreset === 'all_time'}
                onChange={(e) => {
                  setDatePreset('custom');
                  setFromDate(e.target.value);
                }}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="to-date">To</Label>
              <Input
                id="to-date"
                type="date"
                value={toDate}
                disabled={datePreset === 'all_time'}
                onChange={(e) => {
                  setDatePreset('custom');
                  setToDate(e.target.value);
                }}
                className="mt-1.5"
              />
            </div>
            {role === 'onboarder' && (
              <div>
                <Label>Claims Scope</Label>
                <Select value={claimsScope} onValueChange={(value) => setClaimsScope(value as 'current' | 'total')}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Claims Only</SelectItem>
                    <SelectItem value="total">Total Claims</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {isQualifier && (
              <div>
                <Label>Category</Label>
                <Select value={downloadCategory} onValueChange={setDownloadCategory}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {PRIMARY_CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isQualifier && (
              <div className="flex items-end">
                <Button className="w-full" onClick={() => handleDownload('xlsx')} disabled={downloading}>
                  {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Download
                </Button>
              </div>
            )}
            {isManagerView && (
              <div>
                <Label>Qualifier</Label>
                <Select value={qualifierId} onValueChange={setQualifierId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="All qualifiers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All qualifiers</SelectItem>
                    {(creatorsQuery.data?.data || []).map((creator) => (
                      <SelectItem key={creator.userId} value={creator.userId}>
                        {creator.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!isQualifier && (
              <div>
                <Label>Template</Label>
                <Select value={template} onValueChange={(value) => setTemplate(value as ExportTemplate)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eod">EOD</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {!isQualifier && (
              <div>
                <Label title="Select which lead status category to include in the download">Lead Category</Label>
                <Select value={reportCategory} onValueChange={(value) => setReportCategory(value as StatusReportCategory)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredReportCategoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!isQualifier && (
              <div className="flex items-end gap-2">
                <Button
                  variant={includeNotes ? 'default' : 'outline'}
                  onClick={() => setIncludeNotes((prev) => !prev)}
                  className="w-full"
                >
                  {includeNotes ? 'Notes: On' : 'Notes: Off'}
                </Button>
              </div>
            )}
            <div>
              <Label>City</Label>
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue
                    placeholder={locationFiltersQuery.isLoading ? 'Loading cities...' : 'All cities'}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cities</SelectItem>
                  {cityOptions.map((city) => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Locality</Label>
              <Select value={localityFilter} onValueChange={setLocalityFilter}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue
                    placeholder={
                      locationFiltersQuery.isLoading ? 'Loading localities...' : 'All localities'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All localities</SelectItem>
                  {localityOptions.map((locality) => (
                    <SelectItem key={locality} value={locality}>{locality}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Local Area</Label>
              <Select value={localAreaFilter} onValueChange={setLocalAreaFilter}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue
                    placeholder={
                      locationFiltersQuery.isLoading ? 'Loading local areas...' : 'All local areas'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All local areas</SelectItem>
                  {localAreaOptions.map((area) => (
                    <SelectItem key={area} value={area}>{area}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gated Community</Label>
              <Select value={gatedCommunityFilter} onValueChange={setGatedCommunityFilter}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue
                    placeholder={
                      gatedCommunityNamesQuery.isLoading ? 'Loading communities...' : 'All communities'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All communities</SelectItem>
                  {gatedCommunityNames.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {isQualifier && (
            <p className="mt-4 text-xs text-gray-500">
              Export includes leads you added in the selected date range with name, phone, category, contact status, and registration status.
            </p>
          )}
        </CardContent>
      </Card>

      <div
        className={cn(
          'grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2',
          cards.length > 6
            ? 'lg:grid-cols-3 xl:grid-cols-7'
            : cards.length > 5
              ? 'lg:grid-cols-3 xl:grid-cols-6'
              : 'lg:grid-cols-5'
        )}
      >
        {cards.map((card) => (
          <Card key={card.label} className="border-gray-200 shadow-sm">
            <CardContent className="pt-6">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{card.label}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isQualifier && categoryBreakdownList.length > 0 && (
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsQuery.isLoading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
              </div>
            ) : (
              <div className="space-y-2">
                {categoryBreakdownList.map((row) => (
                  <div key={row.categoryKey} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                    <span className="text-sm font-medium text-gray-800">{row.categoryName}</span>
                    <span className="text-sm font-semibold text-gray-900">{row.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isQualifier && (
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle>Download Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-xl">
              <div>
                <Label>Category</Label>
                <Select value={downloadCategory} onValueChange={setDownloadCategory}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {PRIMARY_CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => handleDownload('csv')} disabled={downloading}>
                {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Download CSV
              </Button>
              <Button variant="outline" onClick={() => handleDownload('xlsx')} disabled={downloading}>
                {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Download XLSX
              </Button>
            </div>
            {!isQualifier && (
              <p className="text-xs text-gray-500">
                Download uses the Lead Category filter above. Choose &quot;Leads Added&quot; to match the Leads Added card count, or pick Interested / Callback / etc. to match those cards.
              </p>
            )}
            {isQualifier && (
              <p className="text-xs text-gray-500">
                Export includes leads you added in the selected date range with name, phone, category, contact status, and registration status.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {isManagerView && (
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle>Qualifier Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsQuery.isLoading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
              </div>
            ) : (
              <div className="space-y-2">
                {(analyticsQuery.data?.data?.qualifierBreakdown || []).map((row) => (
                  <div key={row.qualifierId} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                    <span className="text-sm font-medium text-gray-800">{row.qualifierName}</span>
                    <span className="text-sm font-semibold text-gray-900">{row.touchedLeads}</span>
                  </div>
                ))}
                {(analyticsQuery.data?.data?.qualifierBreakdown || []).length === 0 && (
                  <p className="text-sm text-gray-500">No activity found for selected filters.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
