'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Upload, FileText, Zap, Settings, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

const navigation: Array<{
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}> = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Tasker List', href: '/leads', icon: Users },
  { name: 'Add Tasker', href: '/leads/new', icon: FileText },
  { name: 'Document Verification', href: '/leads/verification', icon: ShieldCheck, roles: ['operations', 'admin'] },
  { name: 'Ready for Activation', href: '/leads/activation', icon: Zap, roles: ['operations', 'admin'] },
  { name: 'Upload Taskers (CSV)', href: '/leads/bulk-import', icon: Upload },
  { name: 'Upload Taskers (Bulk)', href: '/import', icon: Upload },
  { name: 'Admin Management', href: '/admin-management', icon: Settings, roles: ['admin'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useAdminAuth();

  return (
    <div className="flex h-full w-64 flex-col border-r border-gray-200 bg-white shadow-sm">
      <div className="flex h-16 items-center border-b border-gray-200 px-6 bg-gradient-to-r from-amber-50 to-yellow-50">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="ExtraHand Logo"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <div>
            <p className="text-xs font-medium text-gray-700 leading-tight">Tasker Onboarding System</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-6">
        {navigation
          .filter((item) => {
            // Role-based filtering
            if (item.roles && !item.roles.includes(role || '')) return false;
            // Hide Admin Management unless role is admin (backward compatibility)
            if (item.href === '/admin-management' && role !== 'admin') return false;
            return true;
          })
          .map((item) => {
          // More precise active state checking to avoid highlighting parent routes when on child routes
          let isActive = false;
          if (item.href === '/dashboard') {
            isActive = pathname === '/dashboard';
          } else if (item.href === '/leads') {
            // Only highlight "Tasker List" if we're exactly on /leads, not on /leads/new or /leads/[id]
            isActive = pathname === '/leads';
          } else {
            // For other routes, check if pathname starts with the href
            isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          }
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-amber-50 text-amber-700 border-l-4 border-amber-500 shadow-sm'
                  : 'text-gray-600 hover:bg-amber-50/50 hover:text-amber-600'
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive ? "text-amber-600" : "text-gray-400")} />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

