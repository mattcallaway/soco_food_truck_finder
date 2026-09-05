import React from 'react';
import Link from 'next/link';
import { Truck, MapPin } from 'lucide-react';
import { APP_CONFIG } from '@/config/app-config';

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-900 py-8 px-4 sm:px-6 lg:px-8 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950">
            <Truck className="w-4 h-4" />
          </div>
          <span className="font-semibold text-slate-200">{APP_CONFIG.productName}</span>
          <span className="text-xs text-slate-500 flex items-center gap-1 ml-2">
            <MapPin className="w-3 h-3 text-amber-500" />
            {APP_CONFIG.serviceArea}
          </span>
        </div>

        <div className="flex items-center space-x-6 text-sm">
          <Link href="/" className="hover:text-amber-400 transition-colors">
            Discovery
          </Link>
          <Link href="/favorites" className="hover:text-amber-400 transition-colors">
            Favorites
          </Link>
          <Link href="/admin" className="hover:text-amber-400 transition-colors">
            Admin Portal
          </Link>
        </div>

        <div className="text-xs text-slate-600 text-center md:text-right">
          &copy; {new Date().getFullYear()} {APP_CONFIG.productName}. All schedules subject to vendor updates.
        </div>
      </div>
    </footer>
  );
}
