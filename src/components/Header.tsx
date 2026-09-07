'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Truck, Heart, Shield, MapPin, LogIn, LogOut, User } from 'lucide-react';
import { APP_CONFIG } from '@/config/app-config';
import { getLocalFavorites } from '@/lib/favorites';
import { useAuth } from '@/context/AuthContext';

export default function Header() {
  const [favoriteCount, setFavoriteCount] = useState<number>(0);
  const { user, userProfile, isAdmin, signOutUser, toggleDemoAdmin } = useAuth();

  useEffect(() => {
    const updateCount = () => {
      setFavoriteCount(getLocalFavorites().length);
    };
    updateCount();

    window.addEventListener('favorites-updated', updateCount);
    return () => window.removeEventListener('favorites-updated', updateCount);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center space-x-3 group" data-testid="brand-logo">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight text-white group-hover:text-amber-400 transition-colors">
              {APP_CONFIG.productName}
            </span>
            <span className="block text-xs text-slate-400 font-medium flex items-center gap-1">
              <MapPin className="w-3 h-3 text-amber-500 inline" />
              {APP_CONFIG.serviceArea}
            </span>
          </div>
        </Link>

        {/* Navigation Actions */}
        <nav className="flex items-center space-x-2 sm:space-x-4">
          <Link
            href="/favorites"
            data-testid="header-favorites-link"
            className="flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors relative"
          >
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            <span className="hidden sm:inline">Favorites</span>
            {favoriteCount > 0 && (
              <span className="ml-1 bg-rose-600 text-white text-xs font-bold px-2 py-0.5 rounded-full" data-testid="favorites-count-badge">
                {favoriteCount}
              </span>
            )}
          </Link>

          {/* Admin Navigation (Only visible to admin users or in demo mode) */}
          {isAdmin && (
            <Link
              href="/admin"
              data-testid="header-admin-link"
              className="flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium text-amber-400 hover:text-amber-300 hover:bg-slate-800 border border-amber-500/30 transition-colors"
            >
              <Shield className="w-4 h-4" />
              <span>Admin Portal</span>
            </Link>
          )}

          {/* User Sign In / Account Status */}
          {user || userProfile ? (
            <div className="flex items-center gap-2">
              <button
                onClick={signOutUser}
                data-testid="sign-out-button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:text-rose-400 transition-colors border border-slate-700"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{userProfile?.displayName || user?.email || 'Sign Out'}</span>
              </button>
            </div>
          ) : (
            <Link
              href="/admin/login"
              data-testid="sign-in-link"
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <User className="w-4 h-4 text-amber-500" />
              <span>Sign In</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
