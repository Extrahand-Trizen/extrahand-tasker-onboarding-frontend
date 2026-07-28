'use client';

import Image from 'next/image';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { Button } from '@/components/ui/button';
import { LogOut, User, Menu } from 'lucide-react';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useJWTAuth();

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6 shadow-sm">
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Hamburger menu button for mobile */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {/* <div className="flex items-center gap-2 sm:gap-3">
          <Image
            src="./logo.png"
            alt="ExtraHand Logo"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <h2 className="text-sm sm:text-base font-semibold text-gray-800">Partner Onboarding</h2>
        </div> */}
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {user && (
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
            <User className="h-4 w-4 text-gray-400" />
            <span className="font-medium">{user.email}</span>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={logout} className="gap-2">
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}

