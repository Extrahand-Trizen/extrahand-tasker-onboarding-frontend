'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL;
if (!API_BASE_URL) {
  throw new Error('NEXT_PUBLIC_API_URL or NEXT_PUBLIC_ADMIN_SERVICE_URL environment variable is required');
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams?.get('code');
      const state = searchParams?.get('state');
      const error = searchParams?.get('error');
      const errorDescription = searchParams?.get('error_description');

      if (error) {
        setError(errorDescription || error);
        setLoading(false);
        return;
      }

      if (!code) {
        setError('No authorization code received from Microsoft');
        setLoading(false);
        return;
      }

      try {
        // Send code to backend
        const response = await fetch(
          `${API_BASE_URL}/api/v1/auth/microsoft/callback?code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ''}`,
          { 
            method: 'GET',
            credentials: 'include',
          }
        );

        const data = await response.json();

        if (data.success && data.data) {
          // Store tokens
          localStorage.setItem('accessToken', data.data.accessToken);
          localStorage.setItem('refreshToken', data.data.refreshToken);
          
          // Redirect to dashboard
          router.push('/dashboard');
        } else {
          setError(data.error || 'Authentication failed. Please contact your administrator.');
          setLoading(false);
        }
      } catch (error: any) {
        console.error('Auth callback error:', error);
        setError(error.message || 'Authentication failed. Please try again.');
        setLoading(false);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-amber-50/30">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900">Completing sign in...</p>
                <p className="text-sm text-gray-500 mt-1">Please wait while we verify your account</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-amber-50/30 px-4">
        <Card className="w-full max-w-md shadow-lg border-red-200">
          <CardHeader className="bg-red-50 border-b border-red-200">
            <CardTitle className="text-red-700 flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Authentication Error
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-gray-700">{error}</p>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800">
                <strong>Common issues:</strong>
              </p>
              <ul className="text-xs text-amber-700 mt-2 space-y-1 list-disc list-inside">
                <li>You need a valid invite to access this system</li>
                <li>Your account may not have been created yet</li>
                <li>The email you're using might not be authorized</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button 
                onClick={() => router.push('/login')}
                variant="outline"
                className="flex-1"
              >
                Back to Login
              </Button>
              <Button 
                onClick={() => window.location.reload()}
                className="flex-1"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-amber-50/30">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
              <p className="text-sm text-gray-600">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
