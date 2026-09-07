'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Appearance, Vendor, Venue } from '@/types';
import {
  getAppearances,
  getVendors,
  getVenues,
} from '@/lib/db/store';
import {
  getTodayDateLA,
  getDateLA,
  getThisWeekRangeLA,
  formatDateDisplay,
  isCurrentlyOpen,
} from '@/lib/timezone';
import FilterBar, { DateViewOption } from '@/components/FilterBar';
import VendorCard from '@/components/VendorCard';
import { List, Map as MapIcon, Utensils, AlertCircle } from 'lucide-react';
import { APP_CONFIG } from '@/config/app-config';

// Dynamically import MapLibre map to avoid SSR window issues
const MapLibreMap = dynamic(() => import('@/components/MapLibreMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] bg-slate-950 flex items-center justify-center text-slate-500 rounded-2xl border border-slate-800">
      Loading Sonoma County Map...
    </div>
  ),
});

export default function DiscoveryPage() {
  const [dateView, setDateView] = useState<DateViewOption>('today');
  const [openNowOnly, setOpenNowOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedCuisine, setSelectedCuisine] = useState<string>('');
  const [selectedDietary, setSelectedDietary] = useState<string>('');

  const [mobileTab, setMobileTab] = useState<'list' | 'map'>('list');
  const [selectedAppearanceId, setSelectedAppearanceId] = useState<string | null>(null);

  const [appearances, setAppearances] = useState<Appearance[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // User Geolocation State
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationError(null);
      },
      (err) => {
        console.warn('Geolocation denied or failed:', err);
        setLocationError('Location permission denied. Showing all Sonoma County trucks.');
      }
    );
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [vList, vNodes] = await Promise.all([getVendors(), getVenues()]);
        setVendors(vList);
        setVenues(vNodes);

        // Fetch appearances according to dateView
        let filterArgs: any = {
          city: selectedCity || undefined,
          cuisine: selectedCuisine || undefined,
          dietary: selectedDietary || undefined,
          searchQuery: searchQuery || undefined,
        };

        if (dateView === 'today') {
          filterArgs.date = getTodayDateLA();
        } else if (dateView === 'tomorrow') {
          filterArgs.date = getDateLA(1);
        } else if (dateView === 'this_week') {
          const { start, end } = getThisWeekRangeLA();
          filterArgs.startDate = start;
          filterArgs.endDate = end;
        } else if (dateView === 'upcoming') {
          filterArgs.startDate = getTodayDateLA();
        }

        let appList = await getAppearances(filterArgs);

        if (openNowOnly) {
          appList = appList.filter((a) => isCurrentlyOpen(a.date, a.startTime, a.endTime));
        }

        setAppearances(appList);
      } catch (err) {
        console.error('Failed to load discovery data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [dateView, openNowOnly, searchQuery, selectedCity, selectedCuisine, selectedDietary]);

  // Sync scroll on selectedAppearanceId change
  const handleSelectAppearance = (id: string) => {
    setSelectedAppearanceId(id);
    const element = document.getElementById(`vendor-card-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Top Filter Controls Bar */}
      <FilterBar
        dateView={dateView}
        setDateView={setDateView}
        openNowOnly={openNowOnly}
        setOpenNowOnly={setOpenNowOnly}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedCity={selectedCity}
        setSelectedCity={setSelectedCity}
        selectedCuisine={selectedCuisine}
        setSelectedCuisine={setSelectedCuisine}
        selectedDietary={selectedDietary}
        setSelectedDietary={setSelectedDietary}
        userCoords={userCoords}
        onRequestLocation={handleRequestLocation}
        locationError={locationError}
      />

      {/* Main Split Discovery Workspace */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        {/* Mobile View Toggle Switch */}
        <div className="lg:hidden col-span-1 flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 mb-2">
          <button
            onClick={() => setMobileTab('list')}
            data-testid="mobile-toggle-list"
            className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${
              mobileTab === 'list'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <List className="w-4 h-4" />
            <span>List View ({appearances.length})</span>
          </button>
          <button
            onClick={() => setMobileTab('map')}
            data-testid="mobile-toggle-map"
            className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${
              mobileTab === 'map'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapIcon className="w-4 h-4" />
            <span>Map View</span>
          </button>
        </div>

        {/* LEFT COLUMN: Results List (7 cols on desktop) */}
        <div
          className={`lg:col-span-7 flex flex-col space-y-4 ${
            mobileTab === 'map' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Header Count Summary */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <span>Scheduled Food Trucks</span>
                <span className="text-sm font-normal text-slate-400">
                  ({appearances.length} found)
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Date scope:{' '}
                <span className="text-amber-400 font-semibold capitalize">
                  {dateView.replace('_', ' ')}
                </span>
              </p>
            </div>
          </div>

          {/* Cards List */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-44 bg-slate-900/60 rounded-2xl animate-pulse border border-slate-800"
                />
              ))}
            </div>
          ) : appearances.length === 0 ? (
            <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 text-center space-y-3 my-6">
              <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">No food trucks scheduled</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                We couldn&apos;t find any verified appearances matching your exact filter criteria.
                Try adjusting your city, cuisine, or date selection.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCity('');
                  setSelectedCuisine('');
                  setSelectedDietary('');
                  setOpenNowOnly(false);
                  setDateView('today');
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors inline-block"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {appearances.map((app) => {
                const vendor = vendors.find((v) => v.id === app.vendorId);
                const venue = venues.find((v) => v.id === app.venueId);
                if (!vendor || !venue) return null;

                return (
                  <div key={app.id} id={`vendor-card-${app.id}`}>
                    <VendorCard
                      appearance={app}
                      vendor={vendor}
                      venue={venue}
                      userCoords={userCoords}
                      isSelected={selectedAppearanceId === app.id}
                      onSelect={() => handleSelectAppearance(app.id)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Sticky Interactive Map (5 cols on desktop) */}
        <div
          className={`lg:col-span-5 h-[calc(100vh-12rem)] min-h-[500px] lg:sticky lg:top-40 ${
            mobileTab === 'list' ? 'hidden lg:block' : 'block'
          }`}
        >
          <MapLibreMap
            appearances={appearances}
            vendors={vendors}
            venues={venues}
            selectedAppearanceId={selectedAppearanceId}
            onSelectAppearance={handleSelectAppearance}
          />
        </div>

      </div>
    </div>
  );
}
