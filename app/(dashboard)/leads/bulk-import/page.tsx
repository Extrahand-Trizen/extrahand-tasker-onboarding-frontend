'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BulkLeadImportForm } from '@/components/leads/BulkLeadImportForm';
import { LeadImportHistory } from '@/components/leads/LeadImportHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';

export default function BulkLeadImportPage() {
  const router = useRouter();
  const { role, loading: authLoading } = useJWTAuth();

  // Onboarder cannot upload leads; redirect to dashboard
  useEffect(() => {
    if (!authLoading && role === 'onboarder') {
      router.replace('/dashboard');
    }
  }, [authLoading, role, router]);

  if (!authLoading && role === 'onboarder') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-amber-500 border-r-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Upload Leads (CSV)</h1>
        <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm text-gray-500">
          Bulk import unverified taskers from CSV file
        </p>
      </div>

      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="upload" className="flex-1 sm:flex-none">Upload File</TabsTrigger>
          <TabsTrigger value="history" className="flex-1 sm:flex-none">Import History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="upload">
          <BulkLeadImportForm />
        </TabsContent>
        
        <TabsContent value="history">
          <LeadImportHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}

