'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Document verification has been removed from the onboarding flow.
 * Redirect to leads list so bookmarked URLs still work.
 */
export default function VerificationRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/leads');
  }, [router]);

  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-sm text-gray-500">Redirecting to leads…</p>
    </div>
  );
}
