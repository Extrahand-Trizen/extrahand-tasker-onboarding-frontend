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



  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Upload Leads (CSV/Excel)</h1>
        <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm text-gray-500">
          Bulk import unverified helpers from CSV/Excel file
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

