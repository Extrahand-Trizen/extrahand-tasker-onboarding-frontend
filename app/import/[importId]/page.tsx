'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, User, Phone, MapPin, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function ImportDetailsPage({ params }: { params: Promise<{ importId: string }> }) {
  const { importId } = use(params);
  const [exporting, setExporting] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const usersLimit = 10;
  
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'import-details', importId],
    queryFn: () => adminApi.getImportDetails(importId),
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'imported-users', importId, usersPage],
    queryFn: () => adminApi.getImportedUsers(importId, usersPage, usersLimit),
    enabled: !!data?.data?.importedUserIds && data.data.importedUserIds.length > 0,
  });

  const handleExportUids = async () => {
    try {
      setExporting(true);
      const blob = await adminApi.exportUids(importId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user-uids-${importId}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('UIDs exported successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to export UIDs');
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  const importData = data?.data;

  if (!importData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Import not found</h1>
          <Link href="/import">
            <Button>Back to Import History</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/import">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Import History
          </Button>
        </Link>

        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">Import Details</h1>
              <p className="text-gray-600 mt-2">Import ID: {importData.importId}</p>
            </div>
            {importData.importedUserIds && importData.importedUserIds.length > 0 && (
              <Button 
                onClick={handleExportUids} 
                disabled={exporting}
                variant="outline"
              >
                <Download className="w-4 h-4 mr-2" />
                {exporting ? 'Exporting...' : 'Export UIDs'}
              </Button>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-600">Total Rows</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{importData.totalRows}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-green-600">Success</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">{importData.successCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-red-600">Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{importData.failedCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-600">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={importData.status === 'completed' ? 'success' : 'secondary'}>
                  {importData.status}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Import Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">File Name:</span>
                <span className="font-medium">{importData.fileName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Operation Type:</span>
                <Badge variant="secondary">{importData.operationType || 'create'}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Created At:</span>
                <span>{format(new Date(importData.createdAt), 'MMM dd, yyyy HH:mm:ss')}</span>
              </div>
              {importData.completedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Completed At:</span>
                  <span>{format(new Date(importData.completedAt), 'MMM dd, yyyy HH:mm:ss')}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Imported Users/Leads */}
          {importData.importedUserIds && importData.importedUserIds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Imported Users ({importData.importedUserIds.length})</CardTitle>
                <CardDescription>
                  Showing {usersData?.data?.users.length || 0} of {importData.importedUserIds.length} imported users
                </CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading users...</div>
                ) : usersData?.data?.users && usersData.data.users.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      {usersData.data.users.map((user: any, idx: number) => (
                        <div
                          key={user.uid}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-semibold">
                              {idx + 1 + (usersPage - 1) * usersLimit}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <User className="h-4 w-4 text-gray-400" />
                                <p className="font-medium text-gray-900">
                                  {user.name || 'Unknown User'}
                                </p>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                                {user.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    <span>{user.phone}</span>
                                  </div>
                                )}
                                {user.city && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    <span>{user.city}</span>
                                  </div>
                                )}
                                {user.primarySkill && (
                                  <div className="flex items-center gap-1">
                                    <Briefcase className="h-3 w-3" />
                                    <span>{user.primarySkill}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {user.uid.substring(0, 12)}...
                          </div>
                        </div>
                      ))}
                    </div>
                    {usersData.data.pagination.totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <div className="text-sm text-gray-600">
                          Page {usersData.data.pagination.page} of {usersData.data.pagination.totalPages}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                            disabled={usersPage === 1 || usersLoading}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setUsersPage(p => p + 1)}
                            disabled={usersPage >= usersData.data.pagination.totalPages || usersLoading}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">No users found</div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Errors */}
          {importData.errors && importData.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Errors ({importData.errors.length})</CardTitle>
                <CardDescription>Rows that failed during processing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {importData.errors.map((error: any, idx: number) => (
                    <div key={idx} className="p-3 bg-red-50 rounded-md border border-red-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-red-800">Row {error.row}</p>
                          {error.uid && <p className="text-sm text-gray-600">UID: {error.uid}</p>}
                          {error.phone && <p className="text-sm text-gray-600">Phone: {error.phone}</p>}
                        </div>
                        <p className="text-sm text-red-600">{error.error}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

