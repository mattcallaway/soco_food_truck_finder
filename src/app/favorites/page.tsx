'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getVendors, getAppearances, getVenues } from '@/lib/db/store';
import { getLocalFavorites, toggleLocalFavorite } from '@/lib/favorites';
import { Vendor, Appearance, Venue } from '@/types';
import { formatDateDisplay, formatTimeDisplay, getTodayDateLA } from '@/lib/timezone';
import { Heart, MapPin, Clock, ArrowLeft, Trash2, ShieldCheck } from 'lucide-react';

export default function FavoritesPage() {
  const [favoriteVendors, setFavoriteVendors] = useState<Vendor[]>([]);
  const [appearances, setAppearances] = useState<Appearance[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadFavs = async () => {
    setLoading(true);
    try {
      const favIds = getLocalFavorites();
      const [vList, appList, vNodes] = await Promise.all([
        getVendors(),
        getAppearances({ startDate: getTodayDateLA() }),
        getVenues(),
      ]);

      setFavoriteVendors(vList.filter((v) => favIds.includes(v.id)));
      setAppearances(appList);
      setVenues(vNodes);
    } catch (err) {
      console.error('Failed to load favorites:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFavs();
  }, []);

  const handleRemoveFavorite = (vendorId: string) => {
    toggleLocalFavorite(vendorId);
    setFavoriteVendors((prev) => prev.filter((v) => v.id !== vendorId));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Navigation */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Discovery
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
            <span>My Favorite Vendors</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Saved to this browser session &bull; Syncs automatically when you sign in
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>No account required</span>
        </div>
      </div>

      {/* Saved Vendors List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div key={n} className="h-36 bg-slate-900 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : favoriteVendors.length === 0 ? (
        <div className="bg-slate-900 rounded-3xl p-12 text-center border border-slate-800 space-y-4">
          <Heart className="w-12 h-12 text-slate-700 mx-auto" />
          <h3 className="text-lg font-bold text-white">No favorite vendors saved yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Click the heart (♡) icon on any food truck card while exploring Sonoma County to save it here for quick reference.
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-amber-400 transition-colors"
          >
            Explore Sonoma Food Trucks
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {favoriteVendors.map((vendor) => {
            const nextApp = appearances.find((a) => a.vendorId === vendor.id);
            const nextVenue = nextApp ? venues.find((v) => v.id === nextApp.venueId) : null;

            return (
              <div
                key={vendor.id}
                className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4 flex flex-col justify-between shadow-lg"
              >
                <div className="flex items-start gap-4">
                  <img
                    src={vendor.heroImage}
                    alt={vendor.name}
                    className="w-20 h-20 rounded-xl object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <Link
                        href={`/vendors/${vendor.slug}`}
                        className="font-bold text-white hover:text-amber-400 text-base truncate block"
                      >
                        {vendor.name}
                      </Link>
                      <button
                        onClick={() => handleRemoveFavorite(vendor.id)}
                        className="text-slate-500 hover:text-rose-500 p-1"
                        title="Remove from favorites"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{vendor.cuisines.join(', ')}</p>
                  </div>
                </div>

                {/* Next Appearance Info */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                  <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    Next Scheduled Appearance
                  </div>
                  {nextApp && nextVenue ? (
                    <div>
                      <div className="text-amber-400 font-bold">{nextVenue.canonicalName} ({nextVenue.city})</div>
                      <div className="text-slate-300 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatDateDisplay(nextApp.date)} &bull; {formatTimeDisplay(nextApp.startTime)} – {formatTimeDisplay(nextApp.endTime)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-500 italic">No upcoming schedule currently published</div>
                  )}
                </div>

                <Link
                  href={`/vendors/${vendor.slug}`}
                  className="w-full py-2 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 text-xs font-bold rounded-xl text-center transition-colors block"
                >
                  View Profile & Menu
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
