'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Upload, FileText, Zap, Settings, ShieldCheck, X, ChevronDown, ChevronRight, UserPlus, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { useState } from 'react';

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
  // { name: 'Upload Taskers (Bulk)', href: '/import', icon: Upload }, // ✅ COMMENTED OUT - Direct account creation removed
];

// Admin section items (only for admin role)
const adminSectionItems = [
  { name: 'Create User', href: '/admin-management', icon: UserPlus },
  { name: 'User Management', href: '/admin/users', icon: UserCog },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isMobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { role } = useJWTAuth();
  const [adminSectionOpen, setAdminSectionOpen] = useState(
    pathname?.startsWith('/admin') || pathname === '/admin-management'
  );

  const handleLinkClick = () => {
    // Close mobile menu when a link is clicked
    if (onClose) {
      onClose();
    }
  };

  const isAdmin = role === 'admin';
  const isAdminPath = pathname?.startsWith('/admin') || pathname === '/admin-management';

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-gray-200 bg-white shadow-lg transition-transform duration-300 lg:relative lg:translate-x-0 lg:shadow-sm",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6 bg-gradient-to-r from-amber-50 to-yellow-50">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="ExtraHand Logo"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <div>
            <p className="text-xs font-medium text-gray-700 leading-tight">Partner Onboarding Platform</p>
          </div>
        </div>
        {/* Close button for mobile */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-1 px-3 py-6 overflow-y-auto">
        {/* Regular Navigation Items */}
        {navigation
          .filter((item) => {
            // Role-based filtering
            if (item.roles && !item.roles.includes(role || '')) return false;
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
              onClick={handleLinkClick}
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

        {/* Admin Section (Collapsible) */}
        {isAdmin && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => setAdminSectionOpen(!adminSectionOpen)}
              className={cn(
                'flex items-center justify-between w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isAdminPath
                  ? 'bg-amber-50 text-amber-700'
                  : 'text-gray-600 hover:bg-amber-50/50 hover:text-amber-600'
              )}
            >
              <div className="flex items-center gap-3">
                <Settings className={cn("h-5 w-5", isAdminPath ? "text-amber-600" : "text-gray-400")} />
                <span>Admin</span>
              </div>
              {adminSectionOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {adminSectionOpen && (
              <div className="ml-4 mt-1 space-y-1">
                {adminSectionItems.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={handleLinkClick}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-amber-50 text-amber-700 border-l-4 border-amber-500 shadow-sm'
                          : 'text-gray-600 hover:bg-amber-50/50 hover:text-amber-600'
                      )}
                    >
                      <item.icon className={cn("h-4 w-4 ml-2", isActive ? "text-amber-600" : "text-gray-400")} />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>
      </div>
    </>
  );
}

