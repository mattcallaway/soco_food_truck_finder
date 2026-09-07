# Data Persistence Audit
**SoCo Food Truck Finder — Commit 39a5b0b — 2026-09-07**

---

## Overall Grade: **B+**

The dual-store architecture is well-designed with proper mode-switching logic. The production
safety guard is correctly implemented. The Firestore store code is well-structured and covers all
entity types. The primary weakness is that in-memory filter logic has a Firestore-mode bug,
and Firestore persistence has never been runtime-verified in this environment.

---

## Architecture Overview

```
┌────────────────────────────────────────┐
│          src/lib/db/store.ts           │
│  getDataMode() → 'firebase' | 'demo'  │
│  checkProductionSafety()              │
│                                        │
│  if firebase → firestore-store.ts     │
│  if demo → in-memory arrays           │
└────────────────────────────────────────┘
```

Mode selection (store.ts, line 53–59):
```ts
export function getDataMode(): DataMode {
  const mode = process.env.NEXT_PUBLIC_DATA_MODE || process.env.DATA_MODE;
  if (mode === 'firebase') return 'firebase';
  if (mode === 'demo') return 'demo';
  return hasLiveFirebaseConfig() ? 'firebase' : 'demo';
}
```

Production safety (store.ts, lines 62–69):
```ts
function checkProductionSafety() {
  if (process.env.NODE_ENV === 'production' && (mode !== 'firebase' || !hasLiveFirebaseConfig())) {
    throw new Error('CRITICAL SECURITY ERROR: Production deployment requires DATA_MODE=firebase...');
  }
}
```

---

## Findings

### 🟠 P1 — HIGH: `applyAppearanceFilters()` Reads from Global `memoryVendors`/`memoryVenues` in Firestore Mode

**File:** `src/lib/db/store.ts`, lines 214–273  
**Evidence:**

The `applyAppearanceFilters()` function is shared by both demo and firebase modes. However, when
filtering by `city` or `cuisine` or `searchQuery`, it reads from module-level variables:

```ts
if (filter.city) {
  const venueIdsInCity = memoryVenues    // <-- global in-memory array
    .filter((v) => v.city.toLowerCase() === filter.city!.toLowerCase())
    .map((v) => v.id);
  results = results.filter((a) => venueIdsInCity.includes(a.venueId));
}

if (filter.cuisine) {
  const vendorIds = memoryVendors        // <-- global in-memory array
    .filter((v) => v.cuisines.some(...))
    .map((v) => v.id);
  ...
}
```

In Firestore mode, `fsGetPublicAppearances()` correctly fetches appearances from Firestore
(lines 85–110 of firestore-store.ts), but then the Firestore appearance results are filtered
using `applyAppearanceFilters()` which reads from empty/demo in-memory arrays. This means
city, cuisine, dietary, and search query filters **return wrong results in Firestore mode**.

**Fix:** In Firestore mode, push city/cuisine/dietary filters into Firestore queries, or
pass the venue/vendor collections as parameters to `applyAppearanceFilters()` rather than
reading from module globals.

---

### 🟡 P2 — MEDIUM: Firestore Mode Never Runtime-Verified

**Status:** NOT TESTABLE in current environment  
**Evidence:** No `.env.local` with Firebase credentials exists. All 10 unit tests and 6 E2E
tests run in `DATA_MODE=demo`. No runtime evidence of Firestore reads/writes.

The Firestore store code (`src/lib/db/firestore-store.ts`) is structurally sound:
- Uses `setDoc` with `{ merge: true }` for upserts ✅
- Uses typed document-level IDs as document paths ✅
- Uses `where('isPublished', '==', true)` constraint for public appearance queries ✅

However, the following Firestore behaviors are untested:
- Composite index requirements for multi-constraint queries
- `getDoc` null handling for missing documents
- `getDocs` empty collection handling
- Authentication handshake between client SDK and Firestore

**Risk:** Firestore queries with compound `where` clauses (e.g., `isPublished == true AND status == 'scheduled' AND date == filter.date`) may require composite indexes that have not been created.

**Fix:** Create a Firestore emulator test suite. Document required composite indexes in `firestore.indexes.json`.

---

### 🟡 P2 — MEDIUM: No `firestore.indexes.json` Exists

**Evidence:** Running `ls` on the project root confirms no `firestore.indexes.json`.  
The `fsGetPublicAppearances()` function (firestore-store.ts, line 86) creates a compound query:

```ts
const constraints = [
  where('isPublished', '==', true),
  where('status', '==', 'scheduled')
];
if (filter.date) constraints.push(where('date', '==', filter.date));
```

Firestore requires a composite index for queries on multiple fields. Without an index,
the first production query will fail with: "FAILED_PRECONDITION: The query requires an index."

**Fix:** Define and deploy `firestore.indexes.json` with indexes for:
- `appearances`: `(isPublished ASC, status ASC, date ASC)`

---

### 🟡 P2 — MEDIUM: In-Memory `memoryUserProfiles` Contains Hardcoded Admin Seed Profile

**File:** `src/lib/db/store.ts`, lines 81–90  
**Evidence:**

```ts
let memoryUserProfiles: UserProfile[] = [
  {
    uid: 'admin-seed-uid',
    email: 'admin@soco-food-trucks.local',
    displayName: 'Sonoma Admin',
    role: 'admin',
    ...
  },
];
```

In demo mode, the `admin-seed-uid` user is pre-loaded as admin. This profile is also used by
`AuthContext.toggleDemoAdmin()` which sets `userProfile.uid = 'admin-seed-uid'`. If a real user
has their Firestore document uid set to `admin-seed-uid`, this could create a conflict.

**Risk (Low):** Low because Firestore uses real Firebase UIDs which are UUIDv4s and will never
collide with `admin-seed-uid`. Primarily a code clarity concern.

---

### 🟢 P3 — LOW: Geocoding Cache is In-Memory and Ephemeral

**File:** `src/app/api/admin/geocode/route.ts`, line 4  
**Evidence:**

```ts
const geocodeCache: Record<string, { lat: number; lng: number; displayName: string }> = {};
```

This module-level cache is lost on every server restart / cold start. In a serverless environment
(Vercel), this cache will be empty on every cold invocation, causing unnecessary Nominatim API calls.

**Fix:** Persist the geocode cache in Firestore or Redis, or use a long-lived Next.js data cache.

---

## Verified Correctly Implemented

- ✅ Dual-store routing logic correctly dispatches to Firestore or in-memory based on mode
- ✅ Production safety guard throws on missing Firebase credentials
- ✅ `fsSaveVendor`, `fsSaveVenue`, `fsSaveAppearance` all use `{ merge: true }` — safe upserts
- ✅ Public vs. admin appearance separation is enforced in both data stores
- ✅ `fsDeleteAppearance` uses `deleteDoc` correctly
- ✅ Source, SourceFetch, Observation, ExtractionCandidate all have Firestore implementations
- ✅ User favorites keyed by Firebase UID (`user_favorites/{userId}`)
- ✅ Audit log entries get unique IDs with timestamp entropy
- ✅ Seed data entities are clearly marked `isDemo: true` with `(Demo)` suffixes in names

---

## Data Integrity Assessment

| Collection | Demo Mode | Firestore Mode | Integrity |
|---|---|---|---|
| vendors | ✅ WORKING | ⚠️ UNTESTED | High confidence code is correct |
| venues | ✅ WORKING | ⚠️ UNTESTED | High confidence |
| appearances | ✅ WORKING | ⚠️ UNTESTED | Firestore filter bug (see P1) |
| sources | ✅ WORKING | ⚠️ UNTESTED | High confidence |
| source_fetches | ✅ WORKING | ⚠️ UNTESTED | High confidence |
| observations | ✅ WORKING | ⚠️ UNTESTED | High confidence |
| extraction_candidates | ✅ WORKING | ⚠️ UNTESTED | High confidence |
| menus | ✅ WORKING | ⚠️ UNTESTED | High confidence |
| user_favorites | ✅ WORKING | ⚠️ UNTESTED | High confidence |
| users | ✅ WORKING (seeded) | ⚠️ UNTESTED | Hardcoded seed uid (P2) |
| audit_logs | ✅ WORKING | ⚠️ UNTESTED | adminUserId hardcoded (P2) |
