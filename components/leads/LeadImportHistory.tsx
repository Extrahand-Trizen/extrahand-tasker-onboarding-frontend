'use client';

import { useQuery } from '@tanstack/react-query';
import { caosBulkApi } from '@/lib/api/caos-bulk';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

const statusIcons = {
  completed: CheckCircle,
  failed: XCircle,
  processing: Loader2,
  pending: Clock,
};

const statusColors = {
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  processing: 'bg-blue-100 text-blue-800',
  pending: 'bg-gray-100 text-gray-800',
};

export function LeadImportHistory() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['import-history', 'leads', page],
    queryFn: () => caosBulkApi.getImportHistory({ page, limit }),
  });

  const imports = data?.data.imports || [];
  const pagination = data?.data.pagination;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import History</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-gray-400" />
            <p className="mt-4 text-sm text-gray-600">Loading import history...</p>
          </div>
        ) : imports.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No import history found</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total Rows</TableHead>
                  <TableHead>Success</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((importRecord) => {
                  const StatusIcon = statusIcons[importRecord.status];
                  return (
                    <TableRow key={importRecord.importId}>
                      <TableCell className="font-medium">
                        {importRecord.fileName}
                      </TableCell>
                      <TableCell>
                        {new Date(importRecord.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{importRecord.totalRows}</TableCell>
                      <TableCell className="text-green-600">
                        {importRecord.successCount}
                      </TableCell>
                      <TableCell className="text-red-600">
                        {importRecord.failedCount}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[importRecord.status]}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {importRecord.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link href={`/import/${importRecord.importId}`}>
                          <Button variant="ghost" size="sm">
                            View Details
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-gray-600">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} imports
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === 1}
                    onClick={() => setPage(pagination.page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === pagination.totalPages}
                    onClick={() => setPage(pagination.page + 1)}
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
  );
}

