'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export function ImportHistory() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'import-history'],
    queryFn: () => adminApi.getImportHistory(1, 20),
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  const imports = data?.data?.imports || [];

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Import History</h2>
        <Button variant="outline" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Import ID</TableHead>
              <TableHead>File Name</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Operation</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Success</TableHead>
              <TableHead>Failed</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {imports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  No imports found
                </TableCell>
              </TableRow>
            ) : (
              imports.map((importRecord: any) => (
                <TableRow key={importRecord.importId}>
                  <TableCell className="font-mono text-xs">
                    {importRecord.importId.slice(0, 20)}...
                  </TableCell>
                  <TableCell>{importRecord.fileName}</TableCell>
                  <TableCell>
                    {format(new Date(importRecord.createdAt), 'MMM dd, yyyy HH:mm')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {importRecord.operationType || 'create'}
                    </Badge>
                  </TableCell>
                  <TableCell>{importRecord.totalRows}</TableCell>
                  <TableCell className="text-green-600">
                    {importRecord.successCount}
                  </TableCell>
                  <TableCell className="text-red-600">
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
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

