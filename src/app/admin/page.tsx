'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getVendors,
  getVenues,
  getAppearances,
  getSources,
  getCandidates,
} from '@/lib/db/store';
import { getTodayDateLA, getThisWeekRangeLA } from '@/lib/timezone';
import {
  Truck,
  MapPin,
  Calendar,
  Inbox,
  AlertTriangle,
  Plus,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    activeVendors: 0,
    activeVenues: 0,
    appearancesToday: 0,
    appearancesThisWeek: 0,
    pendingCandidates: 0,
    failingSources: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      try {
        const todayStr = getTodayDateLA();
        const { start, end } = getThisWeekRangeLA();

        const [vendors, venues, todayApps, weekApps, sources, candidates] = await Promise.all([
          getVendors(),
          getVenues(),
          getAppearances({ date: todayStr }),
          getAppearances({ startDate: start, endDate: end }),
          getSources(),
          getCandidates(),
        ]);

        setStats({
          activeVendors: vendors.length,
          activeVenues: venues.filter((v) => v.status === 'active').length,
          appearancesToday: todayApps.length,
          appearancesThisWeek: weekApps.length,
          pendingCandidates: candidates.filter((c) => c.status === 'pending').length,
          failingSources: sources.filter((s) => Boolean(s.lastError)).length,
        });
      } catch (err) {
        console.error('Failed to load admin stats:', err);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* Overview Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">System Operational Overview</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time status of Sonoma County vendors, schedules, and data sources
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/admin/appearances"
            className="px-3.5 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl hover:bg-amber-400 transition-colors flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Add Appearance
          </Link>
          <Link
            href="/admin/review-queue"
            className="px-3.5 py-2 bg-slate-800 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 hover:text-amber-400 transition-colors flex items-center gap-1"
          >
            <Inbox className="w-4 h-4 text-amber-500" /> Review Queue ({stats.pendingCandidates})
          </Link>
        </div>
      </div>

      {/* Operational Counter Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Active Vendors */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>ACTIVE VENDORS</span>
            <Truck className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-extrabold text-white">{loading ? '...' : stats.activeVendors}</div>
          <Link href="/admin/vendors" className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-medium">
            Manage Vendors <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Appearances Today */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>APPEARANCES TODAY</span>
            <Calendar className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{loading ? '...' : stats.appearancesToday}</div>
          <Link href="/admin/appearances" className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-medium">
            View Today&apos;s Table <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Pending Candidates */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>REVIEW QUEUE PENDING</span>
            <Inbox className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{loading ? '...' : stats.pendingCandidates}</div>
          <Link href="/admin/review-queue" className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-medium">
            Review Ingested Items <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Appearances This Week */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>APPEARANCES THIS WEEK</span>
            <Calendar className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{loading ? '...' : stats.appearancesThisWeek}</div>
          <Link href="/admin/appearances" className="text-xs text-indigo-400 hover:underline flex items-center gap-1 font-medium">
            Full Schedule Table <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Active Venues */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>ACTIVE VENUES</span>
            <MapPin className="w-5 h-5 text-sky-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{loading ? '...' : stats.activeVenues}</div>
          <Link href="/admin/venues" className="text-xs text-sky-400 hover:underline flex items-center gap-1 font-medium">
            Manage Venues & Aliases <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Failing Data Sources */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>FAILING DATA SOURCES</span>
            <AlertTriangle className="w-5 h-5 text-rose-500" />
          </div>
          <div className="text-3xl font-extrabold text-rose-400">{loading ? '...' : stats.failingSources}</div>
          <Link href="/admin/sources" className="text-xs text-rose-400 hover:underline flex items-center gap-1 font-medium">
            Inspect Sources & Logs <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
