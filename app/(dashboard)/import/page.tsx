'use client';

import { BulkUploadForm } from '@/components/bulk-upload/BulkUploadForm';
import { ImportHistory } from '@/components/bulk-upload/ImportHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ImportPage() {
  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Upload Partners (Bulk)</h1>
        <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm text-gray-500">
          Bulk upload taskers that will appear in the taskers list with status "Account Created"
        </p>
      </div>

      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="upload" className="flex-1 sm:flex-none">Upload File</TabsTrigger>
          <TabsTrigger value="history" className="flex-1 sm:flex-none">Import History</TabsTrigger>
          
        </TabsList>
        
        <TabsContent value="upload">
          <BulkUploadForm />
        </TabsContent>
        
        <TabsContent value="history">
          <ImportHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}

