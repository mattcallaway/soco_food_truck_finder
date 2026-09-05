'use client';

import React from 'react';
import { Search, Calendar, MapPin, Utensils, Sparkles, Navigation, X } from 'lucide-react';
import { SONOMA_CITIES, CUISINE_TAXONOMY, DIETARY_TAXONOMY } from '@/config/app-config';

export type DateViewOption = 'today' | 'tomorrow' | 'this_week' | 'upcoming';

interface FilterBarProps {
  dateView: DateViewOption;
  setDateView: (view: DateViewOption) => void;
  openNowOnly: boolean;
  setOpenNowOnly: (val: boolean) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  selectedCuisine: string;
  setSelectedCuisine: (cuisine: string) => void;
  selectedDietary: string;
  setSelectedDietary: (dietary: string) => void;
  userCoords: { lat: number; lng: number } | null;
  onRequestLocation: () => void;
  locationError: string | null;
}

export default function FilterBar({
  dateView,
  setDateView,
  openNowOnly,
  setOpenNowOnly,
  searchQuery,
  setSearchQuery,
  selectedCity,
  setSelectedCity,
  selectedCuisine,
  setSelectedCuisine,
  selectedDietary,
  setSelectedDietary,
  userCoords,
  onRequestLocation,
  locationError,
}: FilterBarProps) {
  const dateTabs: { id: DateViewOption; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'tomorrow', label: 'Tomorrow' },
    { id: 'this_week', label: 'This Week' },
    { id: 'upcoming', label: 'Upcoming' },
  ];

  const hasActiveFilters =
    searchQuery || selectedCity || selectedCuisine || selectedDietary || openNowOnly;

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCity('');
    setSelectedCuisine('');
    setSelectedDietary('');
    setOpenNowOnly(false);
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-lg border-b border-slate-800 p-4 sticky top-16 z-30 shadow-lg">
      <div className="max-w-7xl mx-auto space-y-3">
        {/* Row 1: Date Pills & Location Button */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Date Selector Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto max-w-full">
            {dateTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDateView(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  dateView === tab.id
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Location Permission Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={onRequestLocation}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                userCoords
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
              }`}
            >
              <Navigation className="w-3.5 h-3.5 text-amber-500" />
              <span>{userCoords ? 'Near Me Active' : 'Use My Location'}</span>
            </button>

            {/* Open Now Quick Toggle */}
            <button
              onClick={() => setOpenNowOnly(!openNowOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                openNowOnly
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                  : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Open Now</span>
            </button>
          </div>
        </div>

        {/* Row 2: Search Input & Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search truck, venue, cuisine..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {/* City Filter */}
          <div className="relative">
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition-colors appearance-none"
            >
              <option value="">All Sonoma Cities</option>
              {SONOMA_CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <MapPin className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Cuisine Filter */}
          <div className="relative">
            <select
              value={selectedCuisine}
              onChange={(e) => setSelectedCuisine(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition-colors appearance-none"
            >
              <option value="">All Cuisines</option>
              {CUISINE_TAXONOMY.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Utensils className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Dietary Filter */}
          <div className="relative">
            <select
              value={selectedDietary}
              onChange={(e) => setSelectedDietary(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition-colors appearance-none"
            >
              <option value="">All Dietary Options</option>
              {DIETARY_TAXONOMY.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Clear Row */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span>Filtering active results</span>
            <button
              onClick={clearFilters}
              className="text-amber-400 hover:underline flex items-center gap-1 font-medium"
            >
              <X className="w-3.5 h-3.5" /> Clear All Filters
            </button>
          </div>
        )}

        {locationError && (
          <div className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
            {locationError}
          </div>
        )}
      </div>
    </div>
  );
}
