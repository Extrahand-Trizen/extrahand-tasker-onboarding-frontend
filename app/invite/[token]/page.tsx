'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL;
if (!API_BASE_URL) {
  throw new Error('NEXT_PUBLIC_API_URL or NEXT_PUBLIC_ADMIN_SERVICE_URL environment variable is required');
}

interface InviteDetails {
  inviteId: string;
  email: string;
  role: string;
  team?: string;
  department?: string;
  expiresAt: string;
}

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;
  
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  
  // Form fields
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const fetchInviteDetails = async () => {
      if (!token) {
        setError('Invalid invite link');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/admin/invites/${token}`);
        const data = await response.json();

        if (data.success) {
          setInvite(data.data);
        } else {
          setError(data.error || 'Invalid or expired invite');
        }
      } catch (err: any) {
        console.error('Failed to fetch invite:', err);
        setError('Failed to load invite details');
      } finally {
        setLoading(false);
      }
    };

    fetchInviteDetails();
  }, [token]);

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccepting(true);
    setError('');

    // Validate password
    if (!password) {
      setError('Please enter a password');
      setAccepting(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setAccepting(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setAccepting(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteToken: token,
          password,
          name: name.trim() || undefined // Only send if provided
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Redirect to login after success
        setTimeout(() => {
          router.push('/login?message=account-created');
        }, 1500);
      } else {
        setError(data.error || 'Failed to create account');
        setAccepting(false);
      }
    } catch (error: any) {
      setError('Failed to connect to server. Please try again.');
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-amber-50/30">
        <Card className="w-full max-w-2xl shadow-lg mx-4">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
              <p className="text-sm text-gray-600">Loading invite details...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-amber-50/30 px-4">
        <Card className="w-full max-w-2xl shadow-lg border-red-200">
          <CardHeader className="bg-red-50 border-b border-red-200">
            <CardTitle className="text-red-700 flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Invalid Invite
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-gray-700">{error}</p>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800">
                <strong>Possible reasons:</strong>
              </p>
              <ul className="text-xs text-amber-700 mt-2 space-y-1 list-disc list-inside">
                <li>The invite link has expired (invites are valid for 7 days)</li>
                <li>The invite has already been used</li>
                <li>The invite has been revoked by an administrator</li>
                <li>The link is invalid or incomplete</li>
              </ul>
            </div>

            <Button 
              onClick={() => router.push('/login')}
              className="w-full"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invite) return null;

  const expiryDate = new Date(invite.expiresAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const roleDisplay = invite.role.charAt(0).toUpperCase() + invite.role.slice(1);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-amber-50/30 px-4 py-8">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center border-b bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.png"
              alt="ExtraHand Logo"
              width={64}
              height={64}
              className="rounded-lg"
            />
          </div>
          <CardTitle className="text-3xl font-bold text-gray-900">
            You're Invited!
          </CardTitle>
          <CardDescription className="text-base text-gray-600 mt-2">
            Join the ExtraHand {roleDisplay} Team
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-6">
          <div className="text-center">
            <p className="text-gray-700 mb-4">
              You've been invited to join the <strong>ExtraHand Partner Onboarding Platform</strong> with the following role:
            </p>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Role</span>
              <Badge className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1">
                {roleDisplay}
              </Badge>
            </div>
            
            {invite.team && (
              <div className="flex items-center justify-between border-t border-amber-200 pt-3">
                <span className="text-sm font-medium text-gray-600">Team</span>
                <span className="text-sm font-semibold text-gray-900">{invite.team}</span>
              </div>
            )}
            
            {invite.department && (
              <div className="flex items-center justify-between border-t border-amber-200 pt-3">
                <span className="text-sm font-medium text-gray-600">Department</span>
                <span className="text-sm font-semibold text-gray-900">{invite.department}</span>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-amber-200 pt-3">
              <span className="text-sm font-medium text-gray-600">Email</span>
              <span className="text-sm font-mono text-gray-900">{invite.email}</span>
            </div>
          </div>

          <form onSubmit={handleAcceptInvite} className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-4">Complete your account setup:</p>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Full Name (Optional)
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500">This will be displayed in your profile</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password *
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500">Must be at least 8 characters long</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirm Password *
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg">
                {error}
              </div>
            )}

            {accepting && !error && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded-lg">
                Account created successfully! Redirecting to login...
              </div>
            )}

            <Button 
              type="submit"
              disabled={accepting}
              className="w-full py-6 text-lg bg-amber-600 hover:bg-amber-700"
            >
              {accepting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Account...
                </span>
              ) : (
                'Create Account & Join Team'
              )}
            </Button>
          </form>

          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
            <p className="text-xs text-yellow-900 font-medium flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              This invite expires on {expiryDate}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
