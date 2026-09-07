import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';
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
} from '@/types';
import { AppearanceQueryFilter } from './store';

function getDb() {
  if (!db) {
    throw new Error('Firestore is not initialized. Ensure Firebase credentials are provided in .env');
  }
  return db;
}

export async function fsGetVendors(): Promise<Vendor[]> {
  const snapshot = await getDocs(collection(getDb(), 'vendors'));
  return snapshot.docs.map((d) => d.data() as Vendor);
}

export async function fsGetVendorBySlug(slug: string): Promise<Vendor | null> {
  const q = query(collection(getDb(), 'vendors'), where('slug', '==', slug), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as Vendor;
}

export async function fsGetVendorById(id: string): Promise<Vendor | null> {
  const ref = doc(getDb(), 'vendors', id);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as Vendor) : null;
}

export async function fsSaveVendor(vendor: Vendor): Promise<Vendor> {
  const updated = { ...vendor, updatedAt: new Date().toISOString() };
  await setDoc(doc(getDb(), 'vendors', vendor.id), updated, { merge: true });
  return updated;
}

export async function fsGetVenues(): Promise<Venue[]> {
  const snapshot = await getDocs(collection(getDb(), 'venues'));
  return snapshot.docs.map((d) => d.data() as Venue);
}

export async function fsGetVenueBySlug(slug: string): Promise<Venue | null> {
  const q = query(collection(getDb(), 'venues'), where('slug', '==', slug), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as Venue;
}

export async function fsGetVenueById(id: string): Promise<Venue | null> {
  const ref = doc(getDb(), 'venues', id);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as Venue) : null;
}

export async function fsSaveVenue(venue: Venue): Promise<Venue> {
  const updated = { ...venue, updatedAt: new Date().toISOString() };
  await setDoc(doc(getDb(), 'venues', venue.id), updated, { merge: true });
  return updated;
}

export async function fsGetPublicAppearances(filter: AppearanceQueryFilter = {}): Promise<Appearance[]> {
  const constraints = [where('isPublished', '==', true), where('status', '==', 'scheduled')];

  if (filter.date) {
    constraints.push(where('date', '==', filter.date));
  }

  const q = query(collection(getDb(), 'appearances'), ...constraints);
  const snapshot = await getDocs(q);
  let results = snapshot.docs.map((d) => d.data() as Appearance);

  if (filter.startDate) {
    results = results.filter((a) => a.date >= filter.startDate!);
  }
  if (filter.endDate) {
    results = results.filter((a) => a.date <= filter.endDate!);
  }
  if (filter.vendorId) {
    results = results.filter((a) => a.vendorId === filter.vendorId);
  }
  if (filter.venueId) {
    results = results.filter((a) => a.venueId === filter.venueId);
  }

  return results;
}

export async function fsGetAdminAppearances(filter: AppearanceQueryFilter = {}): Promise<Appearance[]> {
  const snapshot = await getDocs(collection(getDb(), 'appearances'));
  let results = snapshot.docs.map((d) => d.data() as Appearance);

  if (filter.date) {
    results = results.filter((a) => a.date === filter.date);
  }
  if (filter.startDate) {
    results = results.filter((a) => a.date >= filter.startDate!);
  }
  if (filter.endDate) {
    results = results.filter((a) => a.date <= filter.endDate!);
  }
  if (filter.vendorId) {
    results = results.filter((a) => a.vendorId === filter.vendorId);
  }
  if (filter.venueId) {
    results = results.filter((a) => a.venueId === filter.venueId);
  }

  return results;
}

export async function fsSaveAppearance(appearance: Appearance): Promise<Appearance> {
  const updated = { ...appearance, updatedAt: new Date().toISOString() };
  await setDoc(doc(getDb(), 'appearances', appearance.id), updated, { merge: true });
  return updated;
}

export async function fsDeleteAppearance(id: string): Promise<boolean> {
  await deleteDoc(doc(getDb(), 'appearances', id));
  return true;
}

export async function fsGetSources(entityType?: string, entityId?: string): Promise<Source[]> {
  const snapshot = await getDocs(collection(getDb(), 'sources'));
  let results = snapshot.docs.map((d) => d.data() as Source);
  if (entityType) results = results.filter((s) => s.entityType === entityType);
  if (entityId) results = results.filter((s) => s.entityId === entityId);
  return results;
}

export async function fsSaveSource(source: Source): Promise<Source> {
  const updated = { ...source, updatedAt: new Date().toISOString() };
  await setDoc(doc(getDb(), 'sources', source.id), updated, { merge: true });
  return updated;
}

export async function fsSaveSourceFetch(fetch: SourceFetch): Promise<SourceFetch> {
  await setDoc(doc(getDb(), 'source_fetches', fetch.id), fetch, { merge: true });
  return fetch;
}

export async function fsSaveObservation(obs: Observation): Promise<Observation> {
  await setDoc(doc(getDb(), 'observations', obs.id), obs, { merge: true });
  return obs;
}

export async function fsGetCandidates(): Promise<ExtractionCandidate[]> {
  const snapshot = await getDocs(collection(getDb(), 'extraction_candidates'));
  return snapshot.docs.map((d) => d.data() as ExtractionCandidate);
}

export async function fsSaveCandidate(candidate: ExtractionCandidate): Promise<ExtractionCandidate> {
  await setDoc(doc(getDb(), 'extraction_candidates', candidate.id), candidate, { merge: true });
  return candidate;
}

export async function fsGetMenuByVendorId(vendorId: string): Promise<Menu | null> {
  const q = query(collection(getDb(), 'menus'), where('vendorId', '==', vendorId), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as Menu;
}

export async function fsGetUserFavorite(userId: string): Promise<UserFavorite | null> {
  const ref = doc(getDb(), 'user_favorites', userId);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as UserFavorite) : null;
}

export async function fsSaveUserFavorite(fav: UserFavorite): Promise<UserFavorite> {
  await setDoc(doc(getDb(), 'user_favorites', fav.userId), fav, { merge: true });
  return fav;
}

export async function fsGetUserProfile(uid: string): Promise<UserProfile | null> {
  const ref = doc(getDb(), 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function fsSaveUserProfile(user: UserProfile): Promise<UserProfile> {
  await setDoc(doc(getDb(), 'users', user.uid), user, { merge: true });
  return user;
}

export async function fsGetAuditLogs(): Promise<AdminAuditLog[]> {
  const snapshot = await getDocs(collection(getDb(), 'audit_logs'));
  return snapshot.docs.map((d) => d.data() as AdminAuditLog);
}

export async function fsAddAuditLog(entry: Omit<AdminAuditLog, 'id' | 'timestamp'>): Promise<AdminAuditLog> {
  const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newLog: AdminAuditLog = {
    id,
    ...entry,
    timestamp: new Date().toISOString(),
  };
  await setDoc(doc(getDb(), 'audit_logs', id), newLog);
  return newLog;
}
