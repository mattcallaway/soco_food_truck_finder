'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, MapPin, Clock, Navigation, ExternalLink, Tag } from 'lucide-react';
import { Appearance, Vendor, Venue } from '@/types';
import { formatTimeDisplay, formatDateDisplay, isCurrentlyOpen } from '@/lib/timezone';
import { isLocalFavorite, toggleLocalFavorite } from '@/lib/favorites';

interface VendorCardProps {
  appearance: Appearance;
  vendor: Vendor;
  venue: Venue;
  userCoords?: { lat: number; lng: number } | null;
  isSelected?: boolean;
  onSelect?: () => void;
}

export default function VendorCard({
  appearance,
  vendor,
  venue,
  userCoords,
  isSelected,
  onSelect,
}: VendorCardProps) {
  const [isFav, setIsFav] = useState<boolean>(false);

  useEffect(() => {
    setIsFav(isLocalFavorite(vendor.id));
  }, [vendor.id]);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = toggleLocalFavorite(vendor.id);
    setIsFav(updated.includes(vendor.id));
  };

  const openNow = isCurrentlyOpen(appearance.date, appearance.startTime, appearance.endTime);

  // Calculate distance in miles if user location is available
  let distanceStr: string | null = null;
  if (userCoords && venue.lat && venue.lng) {
    const R = 3958.8; // Radius of the Earth in miles
    const dLat = ((venue.lat - userCoords.lat) * Math.PI) / 180;
    const dLng = ((venue.lng - userCoords.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((userCoords.lat * Math.PI) / 180) *
        Math.cos((venue.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    distanceStr = `${d.toFixed(1)} mi`;
  }

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${venue.canonicalName}, ${venue.address}, ${venue.city}, CA`
  )}`;

  return (
    <div
      onClick={onSelect}
      className={`group relative bg-slate-900 rounded-2xl overflow-hidden border transition-all duration-200 cursor-pointer shadow-lg hover:shadow-2xl ${
        isSelected
          ? 'border-amber-500 ring-2 ring-amber-500/50 bg-slate-850'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex flex-col sm:flex-row">
        {/* Image Container */}
        <div className="relative w-full sm:w-48 h-48 sm:h-auto flex-shrink-0 bg-slate-950 overflow-hidden">
          <img
            src={vendor.heroImage || 'https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?auto=format&fit=crop&w=600&q=80'}
            alt={vendor.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {/* Favorite Heart Badge */}
          <button
            onClick={handleFavoriteClick}
            aria-label="Toggle Favorite"
            className="absolute top-3 right-3 p-2 rounded-full bg-slate-950/70 backdrop-blur-md text-white hover:scale-110 active:scale-95 transition-transform border border-slate-700 z-10"
          >
            <Heart
              className={`w-5 h-5 transition-colors ${
                isFav ? 'fill-rose-500 text-rose-500' : 'text-slate-300 hover:text-rose-400'
              }`}
            />
          </button>

          {/* Open Now Tag */}
          {openNow && (
            <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-emerald-500 text-slate-950 text-xs font-bold flex items-center gap-1 shadow-md">
              <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse" />
              Open Now
            </div>
          )}

          {/* Demo Badge */}
          {vendor.isDemo && (
            <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-slate-950/80 text-amber-400 text-[10px] font-mono border border-amber-500/40">
              Demo
            </div>
          )}
        </div>

        {/* Content Details */}
        <div className="flex-1 p-5 flex flex-col justify-between">
          <div>
            {/* Header Title & Price */}
            <div className="flex items-start justify-between gap-2">
              <Link
                href={`/vendors/${vendor.slug}`}
                onClick={(e) => e.stopPropagation()}
                className="font-bold text-lg text-white hover:text-amber-400 transition-colors line-clamp-1"
              >
                {vendor.name}
              </Link>
              <span className="text-sm font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                {vendor.priceRange}
              </span>
            </div>

            {/* Cuisines Badges */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {vendor.cuisines.map((c) => (
                <span
                  key={c}
                  className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium"
                >
                  {c}
                </span>
              ))}
              {vendor.dietaryTags.map((d) => (
                <span
                  key={d}
                  className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize"
                >
                  {d.replace('_', '-')}
                </span>
              ))}
            </div>

            {/* Venue & Location */}
            <div className="mt-3 space-y-1.5 text-sm text-slate-300">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <Link
                  href={`/venues/${venue.slug}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium hover:text-amber-300 underline decoration-slate-600 underline-offset-2"
                >
                  {venue.canonicalName}
                </Link>
                <span className="text-slate-500">&bull; {venue.city}</span>
              </div>

              {/* Date & Time */}
              <div className="flex items-center gap-1.5 text-slate-400 text-xs sm:text-sm">
                <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="font-semibold text-amber-400">
                  {formatDateDisplay(appearance.date)}
                </span>
                <span>
                  ({formatTimeDisplay(appearance.startTime)} &ndash;{' '}
                  {formatTimeDisplay(appearance.endTime)})
                </span>
                {distanceStr && (
                  <span className="ml-auto text-xs text-amber-400/90 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    📍 {distanceStr}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-3 text-xs">
            <Link
              href={`/vendors/${vendor.slug}`}
              onClick={(e) => e.stopPropagation()}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-amber-500 hover:text-slate-950 font-semibold transition-colors flex items-center gap-1"
            >
              View Menu & Profile
            </Link>

            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Directions</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
