# Architecture Deep-Dive
## SoCo Food Truck Finder

> For a quick-start and overview see [README.md](README.md).  
> This document covers internal design decisions, data contracts, and implementation details.

---

## Table of Contents

1. [Store Façade Pattern](#1-store-façade-pattern)
2. [Public vs Admin Data Separation](#2-public-vs-admin-data-separation)
3. [Firebase Admin SDK Initialization](#3-firebase-admin-sdk-initialization)
4. [requireAdmin Middleware Contract](#4-requireadmin-middleware-contract)
5. [SSRF Guard Design](#5-ssrf-guard-design)
6. [Schedule Extractor Design](#6-schedule-extractor-design)
7. [Timezone Strategy](#7-timezone-strategy)
8. [MapLibre Readiness Protocol](#8-maplibre-readiness-protocol)
9. [Firestore Security Rules Logic](#9-firestore-security-rules-logic)
10. [Candidate Provenance Chain](#10-candidate-provenance-chain)
11. [Content-Hash Deduplication](#11-content-hash-deduplication)
12. [Demo Mode Safety Guarantees](#12-demo-mode-safety-guarantees)
13. [Auth Context Design](#13-auth-context-design)
14. [Composite Index Strategy](#14-composite-index-strategy)

---

## 1. Store Façade Pattern

`src/lib/db/store.ts` is the single repository interface for all data access. No page, component, or API route imports from `firestore-store.ts` directly.

```typescript
// store.ts selects the implementation at runtime
function getDataMode(): DataMode {
  const mode = process.env.NEXT_PUBLIC_DATA_MODE || process.env.DATA_MODE;
  if (mode === 'firebase' && hasFirebaseConfig()) return 'firebase';
  return 'demo';
}

export async function getPublicAppearances(filter) {
  if (getDataMode() === 'firebase') return fsGetPublicAppearances(filter);
  // in-memory demo path with applyAppearanceFilters(results, filter, vendors, venues)
}
```

**Why pass `vendors`/`venues` as parameters to `applyAppearanceFilters`?**  
The function is called in both demo mode (where data is in module-level arrays) and Firestore mode (where data would be fetched separately). Passing them as explicit parameters avoids stale module-global reads and makes the function independently testable.

---

## 2. Public vs Admin Data Separation

Two separate exported functions handle the isPublished split:

| Function | Filter applied | Use in |
|---|---|---|
| `getPublicAppearances(filter)` | `isPublished=true AND status='scheduled'` | All public pages |
| `getAdminAppearances(filter)` | None — returns everything | Admin pages only |
| `getAppearances(filter)` | Deprecated alias → calls `getPublicAppearances` | Legacy compatibility |

This means admin drafts, tentative appearances, and cancelled events are **never** reachable from public routes regardless of component logic. The filter is applied at the data layer, not the UI layer.

---

## 3. Firebase Admin SDK Initialization

`src/lib/firebase/admin-config.ts` uses the **modular firebase-admin v12+ API** (`firebase-admin/app`, `firebase-admin/auth`) — not the legacy `import admin from 'firebase-admin'` namespace import.

Initialization priority:
1. `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` — full JSON string (highest priority)
2. `FIREBASE_ADMIN_CLIENT_EMAIL` + `FIREBASE_ADMIN_PRIVATE_KEY` + `FIREBASE_ADMIN_PROJECT_ID` — individual fields
3. `applicationDefault()` — uses `GOOGLE_APPLICATION_CREDENTIALS` env var or GCP metadata server

`getApps().length > 0` guard prevents double-initialization during Next.js hot-reload. Returns `null` when no configuration is present (demo mode).

---

## 4. requireAdmin Middleware Contract

```
Input:  NextRequest
Output: string (verified admin UID) | NextResponse (error)

Caller pattern:
  const result = await requireAdmin(request);
  if (result instanceof NextResponse) return result;
  const adminUid = result;
```

Decision tree:
```
hasAdminSdk() === false?
  ├─ production → 503 (misconfiguration)
  └─ dev + x-demo-admin: true header → 'demo-admin-uid'

hasAdminSdk() === true:
  └─ Authorization: Bearer <token>?
       ├─ no/malformed → 401
       └─ yes:
            └─ verifyIdToken(token, checkRevoked=true)
                 ├─ throws auth/id-token-revoked → 401
                 ├─ throws auth/user-disabled   → 401
                 ├─ throws anything else        → 401
                 └─ decoded.admin === true?
                      ├─ no  → 403
                      └─ yes → return decoded.uid
```

The `checkRevoked=true` flag means revoking refresh tokens immediately invalidates existing sessions — important for offboarding admin users.

---

## 5. SSRF Guard Design

`validateOutboundUrl(url)` is called before any outbound fetch from an API route.

```
URL string
  → parse with new URL()        [invalid URL → reject]
  → check scheme is http/https  [other schemes → reject]
  → check no username:password  [credentials → reject]
  → dns.lookup(hostname)        [resolution failure → reject]
  → check resolved IP:
      127.0.0.0/8   → reject (loopback)
      10.0.0.0/8    → reject (RFC 1918)
      172.16.0.0/12 → reject (RFC 1918)
      192.168.0.0/16→ reject (RFC 1918)
      169.254.0.0/16→ reject (link-local / AWS metadata)
      ::1           → reject (IPv6 loopback)
      fc00::/7      → reject (IPv6 unique-local)
  → pass → allowed
```

`guardedFetch(url, options)` wraps `validateOutboundUrl` and also:
- Sets a 10-second `AbortController` timeout
- Caps response body at 5 MB
- Revalidates the URL at every redirect hop (prevents redirect-chain SSRF)
- Sets a descriptive `User-Agent` header

---

## 6. Schedule Extractor Design

`extractScheduleCandidates({ sourceId, vendorId, rawText, sourcePublicationTime })` returns `{ candidates: ExtractionCandidate[], observationIds: string[] }`.

**Pattern matching approach:**
- Regex patterns match day-of-week + venue text + time range
- Examples: `"Friday at Cooper Winery from 4pm–8pm"`, `"Tomorrow at the Barlow, 11am to 3pm"`
- Relative days (`Friday`, `Tomorrow`, `Tonight`, `This Weekend`) are resolved against `sourcePublicationTime` in `America/Los_Angeles`

**ID generation:**
- One `obs-<uuid>` observationId is generated per candidate using `crypto.randomUUID()`
- The candidate is created with `id: 'cand-<uuid>'`
- `candidate.observationIds[0]` always equals the paired `observationIds[0]` in the return value
- This enables the provenance chain: Appearance → observationIds → raw source text

**Confidence scoring:**
- `1.0` — exact venue match + explicit time range + known future date
- `0.7–0.9` — partial venue match or relative date
- `<0.7` — no venue match or ambiguous date

**Warning conditions added to `validationWarnings[]`:**
- `"Source publication time unavailable — date accuracy cannot be guaranteed"`
- `"Venue text did not match any known venue alias"`
- `"Date resolved to past — check source publication time"`

---

## 7. Timezone Strategy

All dates in the system are stored as `YYYY-MM-DD` strings in `America/Los_Angeles` timezone. All times are `HH:mm` 24-hour strings with no timezone suffix.

`src/lib/timezone/index.ts` exports:

| Function | Purpose |
|---|---|
| `getDateLA(offsetDays, refDate?)` | Returns YYYY-MM-DD in LA, `offsetDays` from `refDate` (or `new Date()`) |
| `getNowLA()` | Current LA datetime as `Date` |
| `isCurrentlyOpen(startTime, endTime, date)` | True if current LA time is within the window |
| `formatTimeDisplay(HHmm)` | `'16:00'` → `'4:00 PM'` |
| `getDayOfWeekLA(refDate)` | 0–6 (Sunday=0) in LA timezone |

The `refDate` parameter on `getDateLA` is critical for the extractor: it resolves relative days against the **source publication time** (when the post was made), not the server clock. This prevents `"Friday"` from resolving to the wrong week when the server runs in UTC.

---

## 8. MapLibre Readiness Protocol

The `data-map-ready` attribute on `[data-testid="food-map"]` is the synchronization signal for E2E tests and application logic:

```
Component mount      → data-map-ready="false"
map.on('load') fires → data-map-ready="true"
8s safety timer      → data-map-ready="fallback"  (if load hasn't fired)
```

**Why a safety timer?**  
In E2E test environments the tile server (CARTO/OSM) may be unreachable. The `load` event only fires after the style JSON is fetched — without network access it never fires. The 8-second fallback ensures E2E tests can verify map interaction (markers, popups, flyTo) even without tile loading.

**flyTo guard:**
```typescript
if (mapRef.current && mapRef.current.loaded()) {
  mapRef.current.flyTo({ center: [lng, lat], zoom: 14 });
} else {
  pendingFlyToRef.current = { lng, lat };  // queued for load handler
}
```

---

## 9. Firestore Security Rules Logic

```javascript
// firestore.rules (simplified)

function isAuthenticated() { return request.auth != null; }
function isAdmin() { return request.auth.token.admin == true; }
function isOwner(uid) { return request.auth.uid == uid; }

function doesNotEscalateRole() {
  // User cannot change their own role field
  return !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role']);
}

match /appearances/{id} {
  // Public can only read published+scheduled
  allow read: if resource.data.isPublished == true
                 && resource.data.status == 'scheduled';
  // Admin can read/write all
  allow read, write: if isAdmin();
}

match /users/{uid} {
  allow read: if isOwner(uid) || isAdmin();
  allow write: if isOwner(uid) && doesNotEscalateRole();
  allow write: if isAdmin();  // admin can write anything
}

match /adminAuditLogs/{id} {
  allow read: if isAdmin();
  allow write: if false;  // server-side only
}
```

---

## 10. Candidate Provenance Chain

```
Source.url
  └── SourceFetch.id  (one fetch per check)
        └── Observation.id  (one per extracted schedule signal)
              └── ExtractionCandidate.observationIds[]
                    └── Appearance.observationIds[]  (after approval)
```

This chain means for any public `Appearance` you can trace back to:
- Which URL was fetched
- When it was fetched
- What raw text was extracted
- What the confidence score was
- Who approved the candidate

---

## 11. Content-Hash Deduplication

On every source fetch:
```typescript
const hash = createHash('sha256').update(bodyText).digest('hex');
if (source.lastContentHash === hash) {
  return NextResponse.json({ status: 'unchanged', message: 'Content identical to last fetch' });
}
// proceed with extraction
await store.updateSource(sourceId, { lastContentHash: hash });
```

This prevents the review queue from filling with duplicate candidates when a source page hasn't been updated between polling intervals.

---

## 12. Demo Mode Safety Guarantees

Three independent layers prevent demo mode from running in production:

1. **`checkProductionSafety()`** in `store.ts` — throws if `NODE_ENV=production` and data mode resolves to `demo`
2. **`requireAdmin()` in `require-admin.ts`** — `checkDemoMode()` returns `null` when `NODE_ENV=production`
3. **Admin login UI** — demo toggle rendered only when `process.env.NODE_ENV !== 'production'` (evaluated at SSR time)

None of these three checks are defeatable by environment variables alone — `NODE_ENV=production` must be false for any demo path to activate.

---

## 13. Auth Context Design

`src/context/AuthContext.tsx` exports `useAuth()` which provides:

```typescript
{
  user: FirebaseUser | null,
  profile: UserProfile | null,    // from Firestore users/{uid}
  isAdmin: boolean,               // from user.getIdTokenResult().claims.admin
  isLoading: boolean,
  signOut: () => Promise<void>,
  refreshAdminStatus: () => Promise<void>,
  // Dev-only:
  isDemoAdmin: boolean,
  toggleDemoAdmin: () => void,    // no-op in production
}
```

`isAdmin` is derived from the Firebase ID token claims, **not** from `profile.role`. The Firestore profile doc is fetched for display metadata only.

Admin status is re-checked after sign-in via `getIdTokenResult(true)` (force-refresh) to pick up newly set custom claims.

---

## 14. Composite Index Strategy

`firestore.indexes.json` defines indexes required for compound appearance queries:

```json
[
  // Public query: isPublished + status + date range
  { fields: ["isPublished", "status", "date"] },

  // Vendor schedule page
  { fields: ["vendorId", "date"] },

  // Venue page
  { fields: ["venueId", "date"] },

  // Admin date range queries
  { fields: ["isPublished", "status", "startDate"] }
]
```

Without these indexes, Firestore returns an error for any compound `where` + `orderBy` query. Deploy with `firebase deploy --only firestore:indexes`.
