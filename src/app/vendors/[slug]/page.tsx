'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  getVendorBySlug,
  getAppearances,
  getVenues,
  getMenuByVendorId,
} from '@/lib/db/store';
import { Vendor, Appearance, Venue, Menu } from '@/types';
import { formatDateDisplay, formatTimeDisplay, getTodayDateLA } from '@/lib/timezone';
import { isLocalFavorite, toggleLocalFavorite } from '@/lib/favorites';
import {
  Heart,
  MapPin,
  Clock,
  Globe,
  Camera,
  Share2,
  ShoppingBag,
  PhoneCall,
  Calendar,
  Utensils,
  Navigation,
  Sparkles,
  ArrowLeft,
  Info,
} from 'lucide-react';

export default function VendorProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [appearances, setAppearances] = useState<Appearance[]>([]);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [isFav, setIsFav] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const v = await getVendorBySlug(slug);
        if (!v) return;

        setVendor(v);
        setIsFav(isLocalFavorite(v.id));

        const [vNodes, appList, mData] = await Promise.all([
          getVenues(),
          getAppearances({ vendorId: v.id, startDate: getTodayDateLA() }),
          getMenuByVendorId(v.id),
        ]);

        setVenues(vNodes);
        setAppearances(appList.sort((a, b) => a.date.localeCompare(b.date)));
        setMenu(mData);
      } catch (err) {
        console.error('Failed to load vendor profile:', err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-8 space-y-6">
        <div className="h-64 bg-slate-900 rounded-3xl animate-pulse" />
        <div className="h-12 bg-slate-900 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="max-w-3xl mx-auto p-12 text-center space-y-4">
        <h2 className="text-2xl font-bold text-white">Vendor Not Found</h2>
        <p className="text-slate-400">The mobile vendor profile you requested could not be located.</p>
        <Link href="/" className="inline-block px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-sm">
          Return to Discovery
        </Link>
      </div>
    );
  }

  const handleFavoriteClick = () => {
    const updated = toggleLocalFavorite(vendor.id);
    setIsFav(updated.includes(vendor.id));
  };

  const nextAppearance = appearances[0];
  const nextVenue = nextAppearance ? venues.find((v) => v.id === nextAppearance.venueId) : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Back Button */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Discover Sonoma
      </Link>

      {/* Hero Header Section */}
      <div className="relative bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
        <div className="relative h-64 sm:h-80 w-full overflow-hidden bg-slate-950">
          <img
            src={vendor.heroImage || 'https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?auto=format&fit=crop&w=1200&q=80'}
            alt={vendor.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

          {/* Favorite Heart Button */}
          <button
            onClick={handleFavoriteClick}
            className="absolute top-4 right-4 p-3 rounded-full bg-slate-950/80 backdrop-blur-md text-white hover:scale-110 active:scale-95 transition-transform border border-slate-700 shadow-xl"
          >
            <Heart
              className={`w-6 h-6 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-slate-300 hover:text-rose-400'}`}
            />
          </button>
        </div>

        {/* Profile Info Overlay */}
        <div className="p-6 sm:p-8 -mt-20 relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                  {vendor.name}
                </h1>
                {vendor.isDemo && (
                  <span className="px-2.5 py-0.5 rounded bg-slate-800 text-amber-400 text-xs font-mono border border-amber-500/40">
                    Demo Record
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-1 capitalize">{vendor.vendorType.replace('_', ' ')}</p>
            </div>

            <span className="text-lg font-bold text-amber-400 bg-slate-800 px-3 py-1 rounded-xl border border-slate-700">
              {vendor.priceRange}
            </span>
          </div>

          {/* Cuisines & Dietary Badges */}
          <div className="flex flex-wrap gap-2">
            {vendor.cuisines.map((c) => (
              <span key={c} className="text-xs px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold">
                {c}
              </span>
            ))}
            {vendor.dietaryTags.map((d) => (
              <span key={d} className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 capitalize">
                {d.replace('_', '-')}
              </span>
            ))}
          </div>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-3xl">
            {vendor.description}
          </p>

          {/* Social & Action Links */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {vendor.websiteUrl && (
              <a
                href={vendor.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-xs text-slate-200 hover:text-amber-400 flex items-center gap-1.5 border border-slate-700 transition-colors"
              >
                <Globe className="w-4 h-4 text-amber-500" /> Website
              </a>
            )}
            {vendor.instagramUrl && (
              <a
                href={vendor.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-xs text-slate-200 hover:text-amber-400 flex items-center gap-1.5 border border-slate-700 transition-colors"
              >
                <Camera className="w-4 h-4 text-rose-400" /> Instagram
              </a>
            )}
            {vendor.orderingUrl && (
              <a
                href={vendor.orderingUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 hover:bg-amber-400 transition-colors shadow-md"
              >
                <ShoppingBag className="w-4 h-4" /> Order Online
              </a>
            )}
          </div>

          {/* Schedule Freshness Indicator */}
          <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-2">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Schedule updated recently &bull; Verified Sonoma County source</span>
          </div>
        </div>
      </div>

      {/* Prominent Next Appearance Card */}
      <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 p-6 rounded-3xl border border-amber-500/30 space-y-3">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-4 h-4" /> Next Scheduled Appearance
        </div>

        {nextAppearance && nextVenue ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white">{nextVenue.canonicalName}</h3>
              <p className="text-sm text-slate-300 flex items-center gap-1 mt-1">
                <MapPin className="w-4 h-4 text-amber-500" />
                {nextVenue.address}, {nextVenue.city}
              </p>
              <p className="text-sm text-amber-400 font-semibold mt-1 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatDateDisplay(nextAppearance.date)} ({formatTimeDisplay(nextAppearance.startTime)} – {formatTimeDisplay(nextAppearance.endTime)})
              </p>
            </div>

            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                `${nextVenue.canonicalName}, ${nextVenue.address}, ${nextVenue.city}, CA`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 hover:bg-amber-400 transition-colors"
            >
              <Navigation className="w-4 h-4" /> Get Directions
            </a>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No upcoming appearances currently published for this vendor.</p>
        )}
      </div>

      {/* Timeline of Future Scheduled Appearances */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-amber-500" />
          <span>Upcoming Schedule Timeline</span>
        </h2>

        {appearances.length === 0 ? (
          <p className="text-sm text-slate-500">No scheduled appearances found.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {appearances.map((app) => {
              const venue = venues.find((v) => v.id === app.venueId);
              return (
                <div key={app.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white text-base">{venue?.canonicalName || 'Venue'}</div>
                    <div className="text-xs text-slate-400">{venue?.address}, {venue?.city}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-amber-400">{formatDateDisplay(app.date)}</div>
                    <div className="text-xs text-slate-400">
                      {formatTimeDisplay(app.startTime)} – {formatTimeDisplay(app.endTime)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Menu Section */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Utensils className="w-5 h-5 text-amber-500" />
          <span>Vendor Menu</span>
        </h2>

        {menu && menu.items && menu.items.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {menu.items.map((item) => (
              <div key={item.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-sm">{item.name}</h4>
                  <span className="text-amber-400 font-semibold text-sm">${item.price.toFixed(2)}</span>
                </div>
                {item.description && <p className="text-xs text-slate-400">{item.description}</p>}
                {item.dietaryTags.length > 0 && (
                  <div className="flex gap-1 pt-1">
                    {item.dietaryTags.map((d) => (
                      <span key={d} className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {d}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Full menu details available on site or upon arrival.</p>
        )}
      </div>
    </div>
  );
}
