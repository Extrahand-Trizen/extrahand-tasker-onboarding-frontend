'use client';

import { BulkLeadImportForm } from '@/components/leads/BulkLeadImportForm';
import { LeadImportHistory } from '@/components/leads/LeadImportHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function BulkLeadImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Taskers (CSV)</h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Bulk import unverified taskers from CSV file
        </p>
      </div>

      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload">Upload File</TabsTrigger>
          <TabsTrigger value="history">Import History</TabsTrigger>
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

