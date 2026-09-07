import crypto from 'crypto';
import {
  Vendor,
  Venue,
  Appearance,
  Source,
  SourceFetch,
  Observation,
  ExtractionCandidate,
  Menu,
  AdminAuditLog,
  UserFavorite,
  UserProfile,
  DataMode,
} from '@/types';
import { hasLiveFirebaseConfig } from '../firebase/config';
import {
  INITIAL_DEMO_VENDORS,
  INITIAL_DEMO_VENUES,
  INITIAL_DEMO_APPEARANCES,
  INITIAL_DEMO_SOURCES,
  INITIAL_DEMO_CANDIDATES,
  INITIAL_DEMO_MENUS,
} from '../seed/sonoma-seed';

import {
  fsGetVendors,
  fsGetVendorBySlug,
  fsGetVendorById,
  fsSaveVendor,
  fsGetVenues,
  fsGetVenueBySlug,
  fsGetVenueById,
  fsSaveVenue,
  fsGetPublicAppearances,
  fsGetAdminAppearances,
  fsSaveAppearance,
  fsDeleteAppearance,
  fsGetSources,
  fsSaveSource,
  fsSaveSourceFetch,
  fsSaveObservation,
  fsGetCandidates,
  fsSaveCandidate,
  fsGetMenuByVendorId,
  fsGetUserFavorite,
  fsSaveUserFavorite,
  fsGetUserProfile,
  fsSaveUserProfile,
  fsGetAuditLogs,
  fsAddAuditLog,
} from './firestore-store';

export function getDataMode(): DataMode {
  const mode = process.env.NEXT_PUBLIC_DATA_MODE || process.env.DATA_MODE;
  if (mode === 'firebase') return 'firebase';
  if (mode === 'demo') return 'demo';

  // Fallback check
  return hasLiveFirebaseConfig() ? 'firebase' : 'demo';
}

function checkProductionSafety() {
  const mode = getDataMode();
  if (process.env.NODE_ENV === 'production' && (mode !== 'firebase' || !hasLiveFirebaseConfig())) {
    throw new Error(
      'CRITICAL SECURITY ERROR: Production deployment requires DATA_MODE=firebase and valid Firebase credentials. In-memory persistence is strictly disabled in production.'
    );
  }
}

// In-Memory Fallback State (Development / Demo Mode Only)
let memoryVendors: Vendor[] = [...INITIAL_DEMO_VENDORS];
let memoryVenues: Venue[] = [...INITIAL_DEMO_VENUES];
let memoryAppearances: Appearance[] = [...INITIAL_DEMO_APPEARANCES];
let memorySources: Source[] = [...INITIAL_DEMO_SOURCES];
let memoryFetches: SourceFetch[] = [];
let memoryObservations: Observation[] = [];
let memoryCandidates: ExtractionCandidate[] = [...INITIAL_DEMO_CANDIDATES];
let memoryMenus: Menu[] = [...INITIAL_DEMO_MENUS];
let memoryUserFavorites: UserFavorite[] = [];
let memoryUserProfiles: UserProfile[] = [
  {
    uid: 'admin-seed-uid',
    email: 'admin@soco-food-trucks.local',
    displayName: 'Sonoma Admin',
    role: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
let memoryAuditLogs: AdminAuditLog[] = [];

// Data Access API

export async function getVendors(): Promise<Vendor[]> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsGetVendors();
  return memoryVendors;
}

export async function getVendorBySlug(slug: string): Promise<Vendor | null> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsGetVendorBySlug(slug);
  return memoryVendors.find((v) => v.slug === slug) || null;
}

export async function getVendorById(id: string): Promise<Vendor | null> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsGetVendorById(id);
  return memoryVendors.find((v) => v.id === id) || null;
}

export async function saveVendor(vendor: Vendor): Promise<Vendor> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsSaveVendor(vendor);

  const index = memoryVendors.findIndex((v) => v.id === vendor.id);
  const updated = { ...vendor, updatedAt: new Date().toISOString() };
  if (index >= 0) memoryVendors[index] = updated;
  else memoryVendors.push(updated);
  return updated;
}

export async function getVenues(): Promise<Venue[]> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsGetVenues();
  return memoryVenues;
}

export async function getVenueBySlug(slug: string): Promise<Venue | null> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsGetVenueBySlug(slug);
  return memoryVenues.find((v) => v.slug === slug) || null;
}

export async function getVenueById(id: string): Promise<Venue | null> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsGetVenueById(id);
  return memoryVenues.find((v) => v.id === id) || null;
}

export async function saveVenue(venue: Venue): Promise<Venue> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsSaveVenue(venue);

  const index = memoryVenues.findIndex((v) => v.id === venue.id);
  const updated = { ...venue, updatedAt: new Date().toISOString() };
  if (index >= 0) memoryVenues[index] = updated;
  else memoryVenues.push(updated);
  return updated;
}

export async function matchVenueAlias(venueText: string): Promise<Venue | null> {
  checkProductionSafety();
  if (!venueText) return null;
  const venues = await getVenues();
  const clean = venueText.trim().toLowerCase();

  for (const venue of venues) {
    const canonLower = venue.canonicalName.toLowerCase();
    if (canonLower === clean) return venue;
    if (venue.aliases.some((alias) => alias.toLowerCase() === clean)) return venue;
    if (clean.includes(canonLower) || canonLower.includes(clean)) return venue;
  }

  for (const venue of venues) {
    for (const alias of venue.aliases) {
      const aliasLower = alias.toLowerCase();
      if (clean.includes(aliasLower) || aliasLower.includes(clean)) return venue;
    }
  }

  return null;
}

export interface AppearanceQueryFilter {
  date?: string;
  startDate?: string;
  endDate?: string;
  vendorId?: string;
  venueId?: string;
  city?: string;
  cuisine?: string;
  dietary?: string;
  searchQuery?: string;
}

/**
 * Public appearances query: ONLY returns published, non-cancelled appearances.
 */
export async function getPublicAppearances(filter: AppearanceQueryFilter = {}): Promise<Appearance[]> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsGetPublicAppearances(filter);

  let results = memoryAppearances.filter((a) => a.isPublished && a.status === 'scheduled');
  return applyAppearanceFilters(results, filter, memoryVendors, memoryVenues);
}

/**
 * Admin appearances query: Returns all appearances (including draft, tentative, cancelled).
 */
export async function getAdminAppearances(filter: AppearanceQueryFilter = {}): Promise<Appearance[]> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsGetAdminAppearances(filter);

  return applyAppearanceFilters([...memoryAppearances], filter, memoryVendors, memoryVenues);
}

// Deprecated wrapper mapped to getPublicAppearances for client backwards compatibility
export async function getAppearances(filter: AppearanceQueryFilter = {}): Promise<Appearance[]> {
  return getPublicAppearances(filter);
}

/**
 * Applies in-memory appearance filters.
 * Vendors and venues are passed as parameters to avoid reading from stale module globals,
 * which would produce incorrect results in Firestore mode.
 */
function applyAppearanceFilters(
  results: Appearance[],
  filter: AppearanceQueryFilter,
  vendors: Vendor[] = [],
  venues: Venue[] = []
): Appearance[] {
  if (filter.date) {
    results = results.filter((a) => a.date === filter.date);
  } else {
    if (filter.startDate) results = results.filter((a) => a.date >= filter.startDate!);
    if (filter.endDate) results = results.filter((a) => a.date <= filter.endDate!);
  }

  if (filter.vendorId) results = results.filter((a) => a.vendorId === filter.vendorId);
  if (filter.venueId) results = results.filter((a) => a.venueId === filter.venueId);

  if (filter.city) {
    const venueIdsInCity = venues
      .filter((v) => v.city.toLowerCase() === filter.city!.toLowerCase())
      .map((v) => v.id);
    results = results.filter((a) => venueIdsInCity.includes(a.venueId));
  }

  if (filter.cuisine) {
    const vendorIds = vendors
      .filter((v) => v.cuisines.some((c) => c.toLowerCase() === filter.cuisine!.toLowerCase()))
      .map((v) => v.id);
    results = results.filter((a) => vendorIds.includes(a.vendorId));
  }

  if (filter.dietary) {
    const vendorIds = vendors
      .filter((v) => v.dietaryTags.includes(filter.dietary!))
      .map((v) => v.id);
    results = results.filter((a) => vendorIds.includes(a.vendorId));
  }

  if (filter.searchQuery) {
    const q = filter.searchQuery.toLowerCase();
    const matchingVendors = vendors
      .filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.cuisines.some((c) => c.toLowerCase().includes(q)) ||
          v.description.toLowerCase().includes(q)
      )
      .map((v) => v.id);

    const matchingVenues = venues
      .filter(
        (v) =>
          v.canonicalName.toLowerCase().includes(q) ||
          v.city.toLowerCase().includes(q) ||
          v.address.toLowerCase().includes(q) ||
          v.aliases.some((a) => a.toLowerCase().includes(q))
      )
      .map((v) => v.id);

    results = results.filter(
      (a) => matchingVendors.includes(a.vendorId) || matchingVenues.includes(a.venueId)
    );
  }

  return results;
}

export async function saveAppearance(appearance: Appearance): Promise<Appearance> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsSaveAppearance(appearance);

  const index = memoryAppearances.findIndex((a) => a.id === appearance.id);
  const updated = { ...appearance, updatedAt: new Date().toISOString() };
  if (index >= 0) memoryAppearances[index] = updated;
  else memoryAppearances.push(updated);

  const vendorIndex = memoryVendors.findIndex((v) => v.id === appearance.vendorId);
  if (vendorIndex >= 0) {
    memoryVendors[vendorIndex].lastScheduleUpdate = new Date().toISOString();
  }

  return updated;
}

export async function deleteAppearance(id: string): Promise<boolean> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsDeleteAppearance(id);

  memoryAppearances = memoryAppearances.filter((a) => a.id !== id);
  return true;
}

export async function getSources(entityType?: string, entityId?: string): Promise<Source[]> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsGetSources(entityType, entityId);

  let results = [...memorySources];
  if (entityType) results = results.filter((s) => s.entityType === entityType);
  if (entityId) results = results.filter((s) => s.entityId === entityId);
  return results;
}

export async function saveSource(source: Source): Promise<Source> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsSaveSource(source);

  const index = memorySources.findIndex((s) => s.id === source.id);
  const updated = { ...source, updatedAt: new Date().toISOString() };
  if (index >= 0) memorySources[index] = updated;
  else memorySources.push(updated);
  return updated;
}

export async function saveSourceFetch(fetch: SourceFetch): Promise<SourceFetch> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsSaveSourceFetch(fetch);
  memoryFetches.push(fetch);
  return fetch;
}

export async function saveObservation(obs: Observation): Promise<Observation> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsSaveObservation(obs);
  memoryObservations.push(obs);
  return obs;
}

export async function getCandidates(): Promise<ExtractionCandidate[]> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsGetCandidates();
  return memoryCandidates;
}

export async function saveCandidate(candidate: ExtractionCandidate): Promise<ExtractionCandidate> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsSaveCandidate(candidate);

  const idx = memoryCandidates.findIndex((c) => c.id === candidate.id);
  if (idx >= 0) memoryCandidates[idx] = candidate;
  else memoryCandidates.push(candidate);
  return candidate;
}

export async function approveCandidate(
  candidateId: string,
  overrides?: { venueId?: string; date?: string; startTime?: string; endTime?: string }
): Promise<Appearance | null> {
  checkProductionSafety();
  const candidate = (await getCandidates()).find((c) => c.id === candidateId);
  if (!candidate) return null;

  candidate.status = 'approved';
  await saveCandidate(candidate);

  const venueId = overrides?.venueId || candidate.matchedVenueId || 'venue-henhouse-demo';
  const date = overrides?.date || candidate.date;
  const startTime = overrides?.startTime || candidate.startTime;
  const endTime = overrides?.endTime || candidate.endTime;

  if (candidate.proposedVenueText) {
    const venue = await getVenueById(venueId);
    if (venue && !venue.aliases.includes(candidate.proposedVenueText)) {
      venue.aliases.push(candidate.proposedVenueText);
      await saveVenue(venue);
    }
  }

  const newAppearance: Appearance = {
    id: `app-${crypto.randomUUID()}`,
    vendorId: candidate.vendorId,
    venueId,
    date,
    startTime,
    endTime,
    status: 'scheduled',
    isPublished: true,
    isManualOverride: false,
    observationIds: candidate.observationIds,
    notes: `Approved candidate from source ${candidate.sourceId}`,
    createdBy: 'admin-review',
    updatedBy: 'admin-review',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveAppearance(newAppearance);
  return newAppearance;
}

export async function rejectCandidate(candidateId: string): Promise<boolean> {
  checkProductionSafety();
  const candidate = (await getCandidates()).find((c) => c.id === candidateId);
  if (candidate) {
    candidate.status = 'rejected';
    await saveCandidate(candidate);
    return true;
  }
  return false;
}

export async function getMenuByVendorId(vendorId: string): Promise<Menu | null> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsGetMenuByVendorId(vendorId);
  return memoryMenus.find((m) => m.vendorId === vendorId) || null;
}

export async function getUserFavorite(userId: string): Promise<UserFavorite | null> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsGetUserFavorite(userId);
  return memoryUserFavorites.find((f) => f.userId === userId) || null;
}

export async function saveUserFavorite(fav: UserFavorite): Promise<UserFavorite> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsSaveUserFavorite(fav);

  const idx = memoryUserFavorites.findIndex((f) => f.userId === fav.userId);
  if (idx >= 0) memoryUserFavorites[idx] = fav;
  else memoryUserFavorites.push(fav);
  return fav;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsGetUserProfile(uid);
  return memoryUserProfiles.find((p) => p.uid === uid) || null;
}

export async function saveUserProfile(user: UserProfile): Promise<UserProfile> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsSaveUserProfile(user);

  const idx = memoryUserProfiles.findIndex((p) => p.uid === user.uid);
  if (idx >= 0) memoryUserProfiles[idx] = user;
  else memoryUserProfiles.push(user);
  return user;
}

export async function getAuditLogs(): Promise<AdminAuditLog[]> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsGetAuditLogs();
  return memoryAuditLogs;
}

export async function addAuditLog(
  entry: Omit<AdminAuditLog, 'id' | 'timestamp'>
): Promise<AdminAuditLog> {
  checkProductionSafety();
  if (getDataMode() === 'firebase') return fsAddAuditLog(entry);

  const newLog: AdminAuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    ...entry,
    timestamp: new Date().toISOString(),
  };
  memoryAuditLogs.unshift(newLog);
  return newLog;
}
