import {
  Vendor,
  Venue,
  Appearance,
  Source,
  ExtractionCandidate,
  Menu,
  AdminAuditLog,
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

// Memory store for development fallback
let memoryVendors: Vendor[] = [...INITIAL_DEMO_VENDORS];
let memoryVenues: Venue[] = [...INITIAL_DEMO_VENUES];
let memoryAppearances: Appearance[] = [...INITIAL_DEMO_APPEARANCES];
let memorySources: Source[] = [...INITIAL_DEMO_SOURCES];
let memoryCandidates: ExtractionCandidate[] = [...INITIAL_DEMO_CANDIDATES];
let memoryMenus: Menu[] = [...INITIAL_DEMO_MENUS];
let memoryAuditLogs: AdminAuditLog[] = [];

function checkProductionSafety() {
  if (process.env.NODE_ENV === 'production' && !hasLiveFirebaseConfig()) {
    throw new Error(
      'CRITICAL: Firebase configuration is missing in production environment. Local memory fallback is disabled for security.'
    );
  }
}

export async function getVendors(): Promise<Vendor[]> {
  checkProductionSafety();
  return memoryVendors;
}

export async function getVendorBySlug(slug: string): Promise<Vendor | null> {
  checkProductionSafety();
  return memoryVendors.find((v) => v.slug === slug) || null;
}

export async function getVendorById(id: string): Promise<Vendor | null> {
  checkProductionSafety();
  return memoryVendors.find((v) => v.id === id) || null;
}

export async function saveVendor(vendor: Vendor): Promise<Vendor> {
  checkProductionSafety();
  const index = memoryVendors.findIndex((v) => v.id === vendor.id);
  const updated = { ...vendor, updatedAt: new Date().toISOString() };
  if (index >= 0) {
    memoryVendors[index] = updated;
  } else {
    memoryVendors.push(updated);
  }
  return updated;
}

export async function getVenues(): Promise<Venue[]> {
  checkProductionSafety();
  return memoryVenues;
}

export async function getVenueBySlug(slug: string): Promise<Venue | null> {
  checkProductionSafety();
  return memoryVenues.find((v) => v.slug === slug) || null;
}

export async function getVenueById(id: string): Promise<Venue | null> {
  checkProductionSafety();
  return memoryVenues.find((v) => v.id === id) || null;
}

export async function saveVenue(venue: Venue): Promise<Venue> {
  checkProductionSafety();
  const index = memoryVenues.findIndex((v) => v.id === venue.id);
  const updated = { ...venue, updatedAt: new Date().toISOString() };
  if (index >= 0) {
    memoryVenues[index] = updated;
  } else {
    memoryVenues.push(updated);
  }
  return updated;
}

/**
 * Matches a raw venue string (e.g. "Hen House Santa Rosa") against canonical venues and aliases.
 */
export async function matchVenueAlias(venueText: string): Promise<Venue | null> {
  checkProductionSafety();
  if (!venueText) return null;
  const clean = venueText.trim().toLowerCase();

  for (const venue of memoryVenues) {
    const canonLower = venue.canonicalName.toLowerCase();
    if (canonLower === clean) return venue;
    if (venue.aliases.some((alias) => alias.toLowerCase() === clean)) return venue;
    if (clean.includes(canonLower) || canonLower.includes(clean)) return venue;
  }

  // Partial alias match fallback
  for (const venue of memoryVenues) {
    for (const alias of venue.aliases) {
      const aliasLower = alias.toLowerCase();
      if (clean.includes(aliasLower) || aliasLower.includes(clean)) {
        return venue;
      }
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

export async function getAppearances(filter: AppearanceQueryFilter = {}): Promise<Appearance[]> {
  checkProductionSafety();
  let results = [...memoryAppearances];

  if (filter.date) {
    results = results.filter((a) => a.date === filter.date);
  } else {
    if (filter.startDate) {
      results = results.filter((a) => a.date >= filter.startDate!);
    }
    if (filter.endDate) {
      results = results.filter((a) => a.date <= filter.endDate!);
    }
  }

  if (filter.vendorId) {
    results = results.filter((a) => a.vendorId === filter.vendorId);
  }

  if (filter.venueId) {
    results = results.filter((a) => a.venueId === filter.venueId);
  }

  if (filter.city) {
    const venueIdsInCity = memoryVenues
      .filter((v) => v.city.toLowerCase() === filter.city!.toLowerCase())
      .map((v) => v.id);
    results = results.filter((a) => venueIdsInCity.includes(a.venueId));
  }

  if (filter.cuisine) {
    const vendorIdsWithCuisine = memoryVendors
      .filter((v) => v.cuisines.some((c) => c.toLowerCase() === filter.cuisine!.toLowerCase()))
      .map((v) => v.id);
    results = results.filter((a) => vendorIdsWithCuisine.includes(a.vendorId));
  }

  if (filter.dietary) {
    const vendorIdsWithDietary = memoryVendors
      .filter((v) => v.dietaryTags.includes(filter.dietary!))
      .map((v) => v.id);
    results = results.filter((a) => vendorIdsWithDietary.includes(a.vendorId));
  }

  if (filter.searchQuery) {
    const q = filter.searchQuery.toLowerCase();
    const matchingVendors = memoryVendors.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.cuisines.some((c) => c.toLowerCase().includes(q)) ||
        v.description.toLowerCase().includes(q)
    ).map(v => v.id);

    const matchingVenues = memoryVenues.filter(
      (v) =>
        v.canonicalName.toLowerCase().includes(q) ||
        v.city.toLowerCase().includes(q) ||
        v.address.toLowerCase().includes(q) ||
        v.aliases.some((a) => a.toLowerCase().includes(q))
    ).map(v => v.id);

    results = results.filter(
      (a) => matchingVendors.includes(a.vendorId) || matchingVenues.includes(a.venueId)
    );
  }

  return results;
}

export async function saveAppearance(appearance: Appearance): Promise<Appearance> {
  checkProductionSafety();
  const index = memoryAppearances.findIndex((a) => a.id === appearance.id);
  const updated = { ...appearance, updatedAt: new Date().toISOString() };
  if (index >= 0) {
    memoryAppearances[index] = updated;
  } else {
    memoryAppearances.push(updated);
  }

  // Update vendor lastScheduleUpdate
  const vendorIndex = memoryVendors.findIndex((v) => v.id === appearance.vendorId);
  if (vendorIndex >= 0) {
    memoryVendors[vendorIndex].lastScheduleUpdate = new Date().toISOString();
  }

  return updated;
}

export async function deleteAppearance(id: string): Promise<boolean> {
  checkProductionSafety();
  memoryAppearances = memoryAppearances.filter((a) => a.id !== id);
  return true;
}

export async function getSources(entityType?: string, entityId?: string): Promise<Source[]> {
  checkProductionSafety();
  let results = [...memorySources];
  if (entityType) {
    results = results.filter((s) => s.entityType === entityType);
  }
  if (entityId) {
    results = results.filter((s) => s.entityId === entityId);
  }
  return results;
}

export async function saveSource(source: Source): Promise<Source> {
  checkProductionSafety();
  const index = memorySources.findIndex((s) => s.id === source.id);
  const updated = { ...source, updatedAt: new Date().toISOString() };
  if (index >= 0) {
    memorySources[index] = updated;
  } else {
    memorySources.push(updated);
  }
  return updated;
}

export async function getCandidates(): Promise<ExtractionCandidate[]> {
  checkProductionSafety();
  return memoryCandidates;
}

export async function approveCandidate(
  candidateId: string,
  overrides?: { venueId?: string; date?: string; startTime?: string; endTime?: string }
): Promise<Appearance | null> {
  checkProductionSafety();
  const candIndex = memoryCandidates.findIndex((c) => c.id === candidateId);
  if (candIndex < 0) return null;

  const candidate = memoryCandidates[candIndex];
  candidate.status = 'approved';

  const venueId = overrides?.venueId || candidate.matchedVenueId || 'venue-henhouse-demo';
  const date = overrides?.date || candidate.date;
  const startTime = overrides?.startTime || candidate.startTime;
  const endTime = overrides?.endTime || candidate.endTime;

  // Learn alias if proposed venue text differs from canonical name
  if (candidate.proposedVenueText) {
    const venue = memoryVenues.find((v) => v.id === venueId);
    if (venue && !venue.aliases.includes(candidate.proposedVenueText)) {
      venue.aliases.push(candidate.proposedVenueText);
    }
  }

  const newAppearance: Appearance = {
    id: `app-extracted-${Date.now()}`,
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

  memoryAppearances.push(newAppearance);
  return newAppearance;
}

export async function rejectCandidate(candidateId: string): Promise<boolean> {
  checkProductionSafety();
  const candidate = memoryCandidates.find((c) => c.id === candidateId);
  if (candidate) {
    candidate.status = 'rejected';
    return true;
  }
  return false;
}

export async function getMenuByVendorId(vendorId: string): Promise<Menu | null> {
  checkProductionSafety();
  return memoryMenus.find((m) => m.vendorId === vendorId) || null;
}

export async function saveMenu(menu: Menu): Promise<Menu> {
  checkProductionSafety();
  const index = memoryMenus.findIndex((m) => m.vendorId === menu.vendorId);
  const updated = { ...menu, updatedAt: new Date().toISOString() };
  if (index >= 0) {
    memoryMenus[index] = updated;
  } else {
    memoryMenus.push(updated);
  }
  return updated;
}

export async function getAuditLogs(): Promise<AdminAuditLog[]> {
  checkProductionSafety();
  return memoryAuditLogs;
}

export async function addAuditLog(
  entry: Omit<AdminAuditLog, 'id' | 'timestamp'>
): Promise<AdminAuditLog> {
  checkProductionSafety();
  const newLog: AdminAuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    ...entry,
    timestamp: new Date().toISOString(),
  };
  memoryAuditLogs.unshift(newLog);
  return newLog;
}
