export type DataMode = 'firebase' | 'demo';
export type UserRole = 'admin' | 'user';

export interface UserProfile {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export type VendorType =
  | 'food_truck'
  | 'trailer'
  | 'cart'
  | 'popup'
  | 'taco_stand'
  | 'mobile_pizza'
  | 'other';

export type PriceRange = '$' | '$$' | '$$$' | '$$$$';

export interface Vendor {
  id: string;
  slug: string;
  name: string;
  isDemo: boolean;
  heroImage: string;
  images: string[];
  vendorType: VendorType;
  cuisines: string[];
  description: string;
  priceRange: PriceRange;
  dietaryTags: string[]; // e.g. ['vegetarian', 'vegan', 'gluten_free']
  websiteUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  orderingUrl?: string;
  cateringInfo?: string;
  menuId?: string;
  favoriteCount: number;
  lastScheduleUpdate: string; // ISO string
  createdAt: string;
  updatedAt: string;
}

export interface Venue {
  id: string;
  slug: string;
  canonicalName: string;
  address: string;
  city: string; // e.g. 'Santa Rosa', 'Petaluma', 'Rohnert Park', 'Cotati', 'Sebastopol', 'Windsor', 'Healdsburg', 'Sonoma', 'Cloverdale'
  lat: number;
  lng: number;
  websiteUrl?: string;
  photoUrl?: string;
  aliases: string[]; // e.g. ['HenHouse', 'Hen House Brewing']
  status: 'active' | 'inactive';
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SourceEntityType = 'vendor' | 'venue' | 'event' | 'system';
export type SourcePurpose = 'schedule' | 'menu' | 'profile' | 'images' | 'general';
export type SourceType = 'website' | 'instagram' | 'facebook' | 'ics' | 'rss' | 'structured_feed' | 'menu_url' | 'other';
export type SourcePriority = 'high' | 'medium' | 'low';

export interface Source {
  id: string;
  entityType: SourceEntityType;
  entityId: string;
  purpose: SourcePurpose;
  sourceType: SourceType;
  url: string;
  name: string;
  enabled: boolean;
  priority: SourcePriority;
  checkFrequencyHours: number;
  parserType: string;
  lastCheckedAt?: string;
  lastSuccessfulAt?: string;
  lastError?: string;
  /** SHA-256 hash of the last successfully fetched content — used for deduplication */
  lastContentHash?: string;
  /** UID of the admin who last modified this record */
  updatedBy?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface SourceFetch {
  id: string;
  sourceId: string;
  fetchedAt: string;
  status: 'success' | 'failed' | 'restricted';
  httpStatus?: number;
  contentType?: string;
  effectiveUrl?: string;
  contentHash?: string;
  parserUsed?: string;
  rawPayload: string;
  errorMessage?: string;
}

export interface Observation {
  id: string;
  sourceId: string;
  fetchId: string;
  vendorId: string;
  venueText: string;
  matchedVenueId?: string;
  date: string; // YYYY-MM-DD in America/Los_Angeles
  startTime: string; // HH:mm format, e.g., '16:00'
  endTime: string; // HH:mm format, e.g., '20:00'
  rawExcerpt: string;
  confidenceScore: number; // 0 to 1
  extractedAt: string;
}

export type AppearanceStatus = 'scheduled' | 'cancelled' | 'completed' | 'tentative';

export interface Appearance {
  id: string;
  vendorId: string;
  venueId: string;
  date: string; // YYYY-MM-DD in America/Los_Angeles
  startTime: string; // HH:mm e.g. '16:00'
  endTime: string; // HH:mm e.g. '20:00'
  status: AppearanceStatus;
  isPublished: boolean;
  isManualOverride: boolean;
  observationIds: string[]; // provenance links
  notes?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionCandidate {
  id: string;
  sourceId: string;
  vendorId: string;
  rawText: string;
  proposedVenueText: string;
  matchedVenueId?: string;
  date: string;
  startTime: string;
  endTime: string;
  confidenceScore: number;
  validationWarnings: string[];
  hasConflicts: boolean;
  conflictNotes?: string;
  observationIds: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export type MenuMode = 'structured' | 'image' | 'link';

export interface MenuItem {
  id: string;
  menuId: string;
  category: string;
  name: string;
  description?: string;
  price: number;
  dietaryTags: string[];
  isAvailable: boolean;
}

export interface Menu {
  id: string;
  vendorId: string;
  mode: MenuMode;
  items?: MenuItem[];
  imageUrl?: string;
  linkUrl?: string;
  updatedAt: string;
}

export interface UserFavorite {
  userId: string;
  vendorIds: string[];
  updatedAt: string;
}

export interface NotificationPreference {
  userId: string;
  favoriteVendorAnywhere: boolean;
  maxDistanceMiles?: number;
  sameDayNotice: boolean;
  dayBeforeNotice: boolean;
  cities: string[];
  updatedAt: string;
}

export interface AdminAuditLog {
  id: string;
  adminUserId: string;
  action: string;
  affectedEntity: string;
  entityId: string;
  previousState?: any;
  newState?: any;
  timestamp: string;
}

export interface SystemSettings {
  productName: string;
  serviceArea: string; // e.g. 'Sonoma County, CA'
  defaultMapCenter: { lat: number; lng: number };
  defaultMapZoom: number;
  mapTileUrl: string;
  mapAttribution: string;
  geocodingApiUrl: string;
  autoPublishConfidenceThreshold: number; // e.g. 0.95
}
