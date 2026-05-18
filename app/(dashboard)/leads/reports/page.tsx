'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { caosApi, type StatusReportCategory } from '@/lib/api/caos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { Loader2, Download } from 'lucide-react';

type ExportTemplate = 'eod' | 'detailed';
type DatePreset = 'today' | 'last_7_days' | 'custom';

const REPORT_CATEGORY_OPTIONS: Array<{ label: string; value: StatusReportCategory }> = [
  { label: 'Touched Leads', value: 'touched_leads' },
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

function getDateRangeFromPreset(preset: Exclude<DatePreset, 'custom'>): { from: string; to: string } {
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
  const { role } = useJWTAuth();
  const isManagerView = role === 'onboarder' || role === 'lead_access_manager';

  const [datePreset, setDatePreset] = useState<DatePreset>('last_7_days');
  const [fromDate, setFromDate] = useState(getDateRangeFromPreset('last_7_days').from);
  const [toDate, setToDate] = useState(getDateRangeFromPreset('last_7_days').to);
  const [qualifierId, setQualifierId] = useState<string>('all');
  const [template, setTemplate] = useState<ExportTemplate>('eod');
  const [reportCategory, setReportCategory] = useState<StatusReportCategory>('touched_leads');
  const [includeNotes, setIncludeNotes] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const analyticsQuery = useQuery({
    queryKey: ['status-analytics', fromDate, toDate, qualifierId],
    queryFn: () =>
      caosApi.getStatusAnalytics({
        from: fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
        to: toDate ? `${toDate}T23:59:59.999Z` : undefined,
        qualifierId: qualifierId !== 'all' ? qualifierId : undefined,
      }),
  });

  const creatorsQuery = useQuery({
    queryKey: ['qualifiers'],
    queryFn: () => caosApi.getQualifiers(),
    enabled: isManagerView,
  });

  const cards = useMemo(
    () => [
      { label: 'Touched Leads', value: analyticsQuery.data?.data?.touchedLeads ?? 0 },
      { label: 'Interested', value: analyticsQuery.data?.data?.interested ?? 0 },
      { label: 'Not Interested', value: analyticsQuery.data?.data?.notInterested ?? 0 },
      { label: 'Callback Scheduled', value: analyticsQuery.data?.data?.callbackScheduled ?? 0 },
      { label: 'Callback Overdue', value: analyticsQuery.data?.data?.callbackOverdue ?? 0 },
    ],
    [analyticsQuery.data]
  );

  const handleDownload = async (format: 'csv' | 'xlsx') => {
    setDownloading(true);
    try {
      const report = await caosApi.downloadStatusReport({
        format,
        template,
        reportCategory,
        from: fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
        to: toDate ? `${toDate}T23:59:59.999Z` : undefined,
        qualifierId: qualifierId !== 'all' ? qualifierId : undefined,
        includeNotes,
      });
      triggerDownload(report.blob, report.filename);
    } finally {
      setDownloading(false);
    }
  };

  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === 'custom') return;
    const range = getDateRangeFromPreset(preset);
    setFromDate(range.from);
    setToDate(range.to);
  };

  return (
    <div className="space-y-6 sm:space-y-8 px-4 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Lead Status Reports</h1>
        <p className="mt-1 text-sm text-gray-500">Analytics and exports for contact-tracking progress</p>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
            <div>
              <Label>Date Range</Label>
              <Select value={datePreset} onValueChange={(value) => handleDatePresetChange(value as DatePreset)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="last_7_days">Last Week (7 days)</SelectItem>
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
                onChange={(e) => {
                  setDatePreset('custom');
                  setToDate(e.target.value);
                }}
                className="mt-1.5"
              />
            </div>
            {isManagerView ? (
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
            ) : (
              <div />
            )}
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
            <div>
              <Label title="Select which lead status category to include in the download">Lead Category</Label>
              <Select value={reportCategory} onValueChange={(value) => setReportCategory(value as StatusReportCategory)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant={includeNotes ? 'default' : 'outline'}
                onClick={() => setIncludeNotes((prev) => !prev)}
                className="w-full"
              >
                {includeNotes ? 'Notes: On' : 'Notes: Off'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.label} className="border-gray-200 shadow-sm">
            <CardContent className="pt-6">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{card.label}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle>Download Report</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => handleDownload('csv')} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Download CSV
          </Button>
          <Button variant="outline" onClick={() => handleDownload('xlsx')} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Download XLSX
          </Button>
        </CardContent>
      </Card>

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
