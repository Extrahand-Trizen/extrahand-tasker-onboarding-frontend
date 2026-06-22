'use client';

import { AuthProvider } from '@/lib/context/AuthContext';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { caosApi } from '@/lib/api/caos';
import dynamic from 'next/dynamic';
import { Header } from '@/components/layout/header';
import { useInactivityTimeout } from '@/lib/hooks/useInactivityTimeout';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const Sidebar = dynamic(() => import('@/components/layout/sidebar').then(m => ({ default: m.Sidebar })), {
  ssr: false,
});

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </AuthProvider>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, logout, user } = useJWTAuth();
  const router = useRouter();
  const [showWarn, setShowWarn] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const currentUserId = user?.userId || (user as any)?.uid;

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useInactivityTimeout({
    inactivityMs: 60 * 60 * 1000, // 1 hour for marketing use-case
    hardCapMs: 24 * 60 * 60 * 1000, // 24 hours hard cap
    warningBeforeMs: 10 * 60 * 1000, // warn 10 minutes before timeout
    onWarn: () => setShowWarn(true),
    onTimeout: () => {
      setShowWarn(false);
      logout();
      router.push('/login');
    },
  });

  const { data: transferNotifications } = useQuery({
    queryKey: ['transfer-notifications', currentUserId],
    queryFn: () => {
      const sinceKey = currentUserId ? `transfer_notifications_since_${currentUserId}` : undefined;
      const since = sinceKey ? localStorage.getItem(sinceKey) || undefined : undefined;
      return caosApi.getTransferNotifications(since);
    },
    enabled: !!currentUserId && !loading && isAuthenticated,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!currentUserId) return;
    const seenKey = `transfer_notifications_seen_${currentUserId}`;
    const sinceKey = `transfer_notifications_since_${currentUserId}`;
    const seenRaw = localStorage.getItem(seenKey);
    const seen: Record<string, boolean> = seenRaw ? JSON.parse(seenRaw) : {};
    let updated = false;
    let latestDecisionAt = localStorage.getItem(sinceKey) || '';

    (transferNotifications?.data || []).forEach((notice) => {
      const decidedAt = notice.decidedAt || '';
      const uniqueKey = `${notice.leadId}_${notice.decision}_${decidedAt}`;
      if (seen[uniqueKey]) return;

      const isSender = notice.fromUserId === currentUserId;
      const isRecipient = notice.toUserId === currentUserId;
      if (!isSender && !isRecipient) return;

      const otherName = isSender
        ? (notice.toUserName || notice.toUserId || 'recipient')
        : (notice.fromUserName || notice.fromUserId || 'sender');

      const message = isSender
        ? `Transfer ${notice.decision} by ${otherName}`
        : `You ${notice.decision} transfer from ${otherName}`;

      if (notice.decision === 'accepted') {
        toast.success(message);
      } else {
        toast.error(message);
      }

      seen[uniqueKey] = true;
      updated = true;

      if (decidedAt && decidedAt > latestDecisionAt) {
        latestDecisionAt = decidedAt;
      }
    });

    if (updated) {
      localStorage.setItem(seenKey, JSON.stringify(seen));
      if (latestDecisionAt) {
        localStorage.setItem(sinceKey, latestDecisionAt);
      }
    }
  }, [transferNotifications, currentUserId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <div className="flex h-screen overflow-hidden">
        <Sidebar 
          isMobileOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header onMenuClick={() => setIsMobileSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto bg-gray-50/50 p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
      <Dialog open={showWarn} onOpenChange={setShowWarn}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session ending soon</DialogTitle>
            <DialogDescription>
              You’ve been inactive. You’ll be logged out in about 10 minutes unless you stay signed in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowWarn(false);
              }}
            >
              Stay signed in
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowWarn(false);
                logout();
                router.push('/login');
              }}
            >
              Logout now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

