'use client';

import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Appearance, Vendor, Venue } from '@/types';
import { APP_CONFIG } from '@/config/app-config';
import { formatTimeDisplay } from '@/lib/timezone';

interface MapProps {
  appearances: Appearance[];
  vendors: Vendor[];
  venues: Venue[];
  selectedAppearanceId?: string | null;
  onSelectAppearance: (id: string) => void;
}

export default function MapLibreMap({
  appearances,
  vendors,
  venues,
  selectedAppearanceId,
  onSelectAppearance,
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: APP_CONFIG.mapTileUrl,
        center: [APP_CONFIG.defaultMapCenter.lng, APP_CONFIG.defaultMapCenter.lat],
        zoom: APP_CONFIG.defaultMapZoom,
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      mapRef.current = map;
    } catch (e) {
      console.error('Failed to initialize MapLibre GL JS map:', e);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    appearances.forEach((app) => {
      const vendor = vendors.find((v) => v.id === app.vendorId);
      const venue = venues.find((v) => v.id === app.venueId);
      if (!venue || !venue.lat || !venue.lng) return;

      const isSelected = selectedAppearanceId === app.id;

      // Custom marker DOM element
      const el = document.createElement('div');
      el.className = `w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all transform shadow-lg ${
        isSelected
          ? 'bg-amber-500 text-slate-950 scale-125 ring-4 ring-amber-300 z-30'
          : 'bg-slate-900 text-amber-400 hover:scale-110 border-2 border-amber-500 z-10'
      }`;
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

      const popupHtml = `
        <div style="font-family: sans-serif; padding: 4px; max-width: 220px;">
          ${
            vendor?.heroImage
              ? `<img src="${vendor.heroImage}" alt="${vendor.name}" style="width: 100%; height: 90px; object-fit: cover; border-radius: 6px; margin-bottom: 6px;" />`
              : ''
          }
          <div style="font-weight: bold; font-size: 14px; color: #0f172a;">${vendor?.name || 'Food Truck'}</div>
          <div style="font-size: 12px; color: #475569; margin-top: 2px;">📍 ${venue.canonicalName} (${venue.city})</div>
          <div style="font-size: 12px; color: #d97706; font-weight: 600; margin-top: 4px;">🕒 ${formatTimeDisplay(
            app.startTime
          )} - ${formatTimeDisplay(app.endTime)}</div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(popupHtml);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([venue.lng, venue.lat])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener('click', () => {
        onSelectAppearance(app.id);
      });

      markersRef.current[app.id] = marker;
    });
  }, [appearances, vendors, venues, selectedAppearanceId, onSelectAppearance]);

  // Fly to selected marker
  useEffect(() => {
    if (!selectedAppearanceId || !mapRef.current) return;
    const app = appearances.find((a) => a.id === selectedAppearanceId);
    if (!app) return;
    const venue = venues.find((v) => v.id === app.venueId);
    if (venue && venue.lat && venue.lng) {
      mapRef.current.flyTo({
        center: [venue.lng, venue.lat],
        zoom: 14,
        speed: 1.2,
      });
      const marker = markersRef.current[selectedAppearanceId];
      if (marker && !marker.getPopup().isOpen()) {
        marker.togglePopup();
      }
    }
  }, [selectedAppearanceId, appearances, venues]);

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden border border-slate-800 shadow-xl bg-slate-950">
      <div ref={mapContainerRef} className="w-full h-full min-h-[400px]" />
      <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-300 pointer-events-none z-10 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        MapLibre GL &bull; {APP_CONFIG.serviceArea}
      </div>
    </div>
  );
}
