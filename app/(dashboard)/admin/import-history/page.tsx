'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { caosBulkApi } from '@/lib/api/caos-bulk';
import { caosApi } from '@/lib/api/caos';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Search, Filter, X, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ImportAnalytics } from '@/components/import-history/ImportAnalytics';

export default function ImportHistoryPage() {
  const { role, loading: authLoading } = useJWTAuth();
  
  // Filters
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [nameFilter, setNameFilter] = useState<string>('all');
  const [emailSearch, setEmailSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Fetch lead creators for the dropdown
  const { data: creatorsData } = useQuery({
    queryKey: ['lead-creators'],
    queryFn: () => caosApi.getLeadCreators(),
    enabled: !authLoading && role === 'lead_access_manager',
  });

  const leadCreators = creatorsData?.data || [];

  // ✅ Only lead_access_manager can access this page
  if (!authLoading && role !== 'lead_access_manager') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Import history visibility is restricted to Lead Access Manager only.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Build filters object
  const filters: any = {
    page,
    limit,
  };

  if (roleFilter !== 'all') {
    filters.role = roleFilter;
  }
  if (nameFilter !== 'all') {
    filters.createdByName = nameFilter;
  }
  if (emailSearch.trim()) {
    filters.createdByEmail = emailSearch.trim();
  }
  if (fromDate) {
    filters.from = new Date(fromDate).toISOString();
  }
  if (toDate) {
    filters.to = new Date(toDate).toISOString();
  }
  if (statusFilter !== 'all') {
    filters.status = statusFilter;
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'import-history', filters],
    queryFn: () => caosBulkApi.getImportHistory(filters),
    enabled: !authLoading && role === 'lead_access_manager',
  });

  const imports = data?.data?.imports || [];
  const pagination = data?.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getRoleBadge = (role?: string) => {
    const variants: Record<string, string> = {
      qualifier: 'bg-purple-100 text-purple-800',
      onboarder: 'bg-blue-100 text-blue-800',
      lead_access_manager: 'bg-red-100 text-red-800',
    };
    return variants[role || ''] || 'bg-gray-100 text-gray-800';
  };

  const handleClearFilters = () => {
    setRoleFilter('all');
    setNameFilter('all');
    setEmailSearch('');
    setFromDate('');
    setToDate('');
    setStatusFilter('all');
    setPage(1);
  };

  const hasActiveFilters = roleFilter !== 'all' || nameFilter !== 'all' || emailSearch || fromDate || toDate || statusFilter !== 'all';

  if (authLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Import History</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            View all CSV imports with uploader details, filters, and pagination
          </p>
        </div>
        <Button
          variant={showAnalytics ? "default" : "outline"}
          onClick={() => setShowAnalytics(!showAnalytics)}
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          {showAnalytics ? 'Hide' : 'Show'} Analytics
        </Button>
      </div>

      {/* Analytics Section */}
      {showAnalytics && (
        <Card>
          <CardHeader>
            <CardTitle>Import Analytics Dashboard</CardTitle>
            <CardDescription>
              Comprehensive analytics and insights about bulk imports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImportAnalytics />
          </CardContent>
        </Card>
      )}

      {/* Filters Card */}
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg sm:text-xl">Filters</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Filter imports by uploader, role, date, and status
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                {showFilters ? 'Hide' : 'Show'} Filters
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="px-4 sm:px-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Role Filter */}
              <div className="space-y-2">
                <Label className="text-sm">Uploader Role</Label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="qualifier">Qualifier</SelectItem>
                    <SelectItem value="onboarder">Onboarder</SelectItem>
                    <SelectItem value="lead_access_manager">Lead Access Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Name Filter */}
              <div className="space-y-2">
                <Label className="text-sm">Uploader Name</Label>
                <Select 
                  value={nameFilter} 
                  onValueChange={(value) => {
                    setNameFilter(value);
                    setPage(1); // Reset to first page when filter changes
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Uploaders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Uploaders</SelectItem>
                    {leadCreators.map((creator) => (
                      <SelectItem key={creator.userId} value={creator.name}>
                        {creator.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Email Search */}
              <div className="space-y-2">
                <Label className="text-sm">Uploader Email</Label>
                <Input
                  type="email"
                  placeholder="Search by email..."
                  value={emailSearch}
                  onChange={(e) => setEmailSearch(e.target.value)}
                />
              </div>

              {/* From Date */}
              <div className="space-y-2">
                <Label className="text-sm">From Date</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              {/* To Date */}
              <div className="space-y-2">
                <Label className="text-sm">To Date</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label className="text-sm">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Import History Table */}
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Import Records</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {pagination.total} total import(s) found
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading imports...</div>
          ) : imports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No imports found. {hasActiveFilters && 'Try adjusting your filters.'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Upload Date</TableHead>
                      <TableHead>Uploaded By</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>File Name</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Success</TableHead>
                      <TableHead>Failed</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {imports.map((importRecord: any) => (
                      <TableRow key={importRecord.importId}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(importRecord.createdAt), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-sm">
                              {importRecord.createdByName || 'Unknown'}
                            </div>
                            {importRecord.createdByEmail && (
                              <div className="text-xs text-gray-500">
                                {importRecord.createdByEmail}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {importRecord.createdByRole && (
                            <Badge className={`text-xs ${getRoleBadge(importRecord.createdByRole)}`}>
                              {importRecord.createdByRole}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={importRecord.fileName}>
                          {importRecord.fileName}
                        </TableCell>
                        <TableCell>{importRecord.totalRows}</TableCell>
                        <TableCell className="text-green-600 font-medium">
                          {importRecord.successCount}
                        </TableCell>
                        <TableCell className="text-red-600 font-medium">
                          {importRecord.failedCount}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(importRecord.status) as any}>
                            {importRecord.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Link href={`/import/${importRecord.importId}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t">
                  <div className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1 || isLoading}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={page >= pagination.totalPages || isLoading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
