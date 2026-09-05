'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Truck, Heart, Shield, MapPin } from 'lucide-react';
import { APP_CONFIG } from '@/config/app-config';
import { getLocalFavorites } from '@/lib/favorites';

export default function Header() {
  const [favoriteCount, setFavoriteCount] = useState<number>(0);

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
        <Link href="/" className="flex items-center space-x-3 group">
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
            className="flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors relative"
          >
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            <span className="hidden sm:inline">Favorites</span>
            {favoriteCount > 0 && (
              <span className="ml-1 bg-rose-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {favoriteCount}
              </span>
            )}
          </Link>

          <Link
            href="/admin"
            className="flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium text-amber-400 hover:text-amber-300 hover:bg-slate-800 border border-amber-500/30 transition-colors"
          >
            <Shield className="w-4 h-4" />
            <span>Admin</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
