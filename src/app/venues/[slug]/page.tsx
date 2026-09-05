'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { getVenueBySlug, getAppearances, getVendors } from '@/lib/db/store';
import { Venue, Appearance, Vendor } from '@/types';
import { formatDateDisplay, formatTimeDisplay, getTodayDateLA } from '@/lib/timezone';
import { MapPin, Calendar, Navigation, ArrowLeft, Truck, Globe } from 'lucide-react';

export default function VenueProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [venue, setVenue] = useState<Venue | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [appearances, setAppearances] = useState<Appearance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadVenue() {
      setLoading(true);
      try {
        const v = await getVenueBySlug(slug);
        if (!v) return;

        setVenue(v);

        const [vList, appList] = await Promise.all([
          getVendors(),
          getAppearances({ venueId: v.id, startDate: getTodayDateLA() }),
        ]);

        setVendors(vList);
        setAppearances(appList.sort((a, b) => a.date.localeCompare(b.date)));
      } catch (err) {
        console.error('Failed to load venue page:', err);
      } finally {
        setLoading(false);
      }
    }

    loadVenue();
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-8 space-y-6">
        <div className="h-48 bg-slate-900 rounded-3xl animate-pulse" />
        <div className="h-12 bg-slate-900 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="max-w-3xl mx-auto p-12 text-center space-y-4">
        <h2 className="text-2xl font-bold text-white">Venue Not Found</h2>
        <p className="text-slate-400">The requested venue page could not be located.</p>
        <Link href="/" className="inline-block px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-sm">
          Return to Discovery
        </Link>
      </div>
    );
  }

  const today = getTodayDateLA();
  const todayAppearances = appearances.filter((a) => a.date === today);
  const upcomingAppearances = appearances.filter((a) => a.date > today);

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${venue.canonicalName}, ${venue.address}, ${venue.city}, CA`
  )}`;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Back Button */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Discovery
      </Link>

      {/* Venue Banner */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{venue.canonicalName}</h1>
            {venue.isDemo && (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-400 text-xs font-mono border border-amber-500/40">
                Demo
              </span>
            )}
          </div>
          <p className="text-slate-300 text-sm flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-amber-500" />
            {venue.address}, {venue.city}, Sonoma County, CA
          </p>
          {venue.aliases.length > 0 && (
            <p className="text-xs text-slate-500">
              Also known as: <span className="text-slate-400">{venue.aliases.join(', ')}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 hover:bg-amber-400 transition-colors shadow-lg"
          >
            <Navigation className="w-4 h-4" /> Directions
          </a>
          {venue.websiteUrl && (
            <a
              href={venue.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-200 text-xs flex items-center gap-1.5 hover:text-amber-400 border border-slate-700 transition-colors"
            >
              <Globe className="w-4 h-4 text-amber-500" /> Venue Site
            </a>
          )}
        </div>
      </div>

      {/* TODAY AT VENUE SECTION */}
      <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Truck className="w-6 h-6 text-amber-500" />
          <span>Food Trucks Here Today</span>
        </h2>

        {todayAppearances.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No food trucks scheduled at {venue.canonicalName} today.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {todayAppearances.map((app) => {
              const vendor = vendors.find((v) => v.id === app.vendorId);
              if (!vendor) return null;
              return (
                <Link
                  key={app.id}
                  href={`/vendors/${vendor.slug}`}
                  className="bg-slate-950 p-4 rounded-2xl border border-slate-800 hover:border-amber-500 transition-all flex items-center gap-4 group"
                >
                  <img
                    src={vendor.heroImage}
                    alt={vendor.name}
                    className="w-20 h-20 rounded-xl object-cover"
                  />
                  <div>
                    <h3 className="font-bold text-white group-hover:text-amber-400 transition-colors">{vendor.name}</h3>
                    <p className="text-xs text-amber-400 font-semibold mt-1">
                      {formatTimeDisplay(app.startTime)} – {formatTimeDisplay(app.endTime)}
                    </p>
                    <div className="flex gap-1 mt-1.5">
                      {vendor.cuisines.map((c) => (
                        <span key={c} className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* UPCOMING AT VENUE SCHEDULE */}
      <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-amber-500" />
          <span>Upcoming Food Truck Schedule</span>
        </h2>

        {upcomingAppearances.length === 0 ? (
          <p className="text-sm text-slate-500">No future appearances scheduled yet.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {upcomingAppearances.map((app) => {
              const vendor = vendors.find((v) => v.id === app.vendorId);
              return (
                <div key={app.id} className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={vendor?.heroImage} alt="" className="w-12 h-12 rounded-lg object-cover" />
                    <div>
                      <Link href={`/vendors/${vendor?.slug}`} className="font-bold text-white hover:text-amber-400 text-sm">
                        {vendor?.name}
                      </Link>
                      <p className="text-xs text-slate-400">{vendor?.cuisines.join(', ')}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-bold text-amber-400">{formatDateDisplay(app.date)}</p>
                    <p className="text-xs text-slate-400">{formatTimeDisplay(app.startTime)} – {formatTimeDisplay(app.endTime)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
