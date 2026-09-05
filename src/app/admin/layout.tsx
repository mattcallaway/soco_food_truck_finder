'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Truck,
  MapPin,
  Calendar,
  Link2,
  Inbox,
  History,
  Settings,
  ShieldAlert,
} from 'lucide-react';
import { APP_CONFIG } from '@/config/app-config';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Vendors', href: '/admin/vendors', icon: Truck },
    { label: 'Venues', href: '/admin/venues', icon: MapPin },
    { label: 'Appearances Table', href: '/admin/appearances', icon: Calendar },
    { label: 'Sources', href: '/admin/sources', icon: Link2 },
    { label: 'Review Queue', href: '/admin/review-queue', icon: Inbox },
    { label: 'Audit Log', href: '/admin/audit', icon: History },
  ];

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col">
      {/* Admin Sub-Header Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-400 font-mono text-xs font-bold border border-amber-500/40">
              ADMIN CONTROL PANEL
            </span>
            <span className="text-xs text-slate-400">&bull; {APP_CONFIG.productName} Ops</span>
          </div>

          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto max-w-full">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
    </div>
  );
}
