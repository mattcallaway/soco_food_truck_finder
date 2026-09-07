# Repair Plan
**SoCo Food Truck Finder — Post-Audit — 2026-09-07**  
**Based on:** Comprehensive audit at commit `39a5b0b`

---

## Priority Levels

| Priority | Definition |
|---|---|
| P0 | Critical — Security flaw that can be exploited in production today |
| P1 | High — Functional defect that will fail or produce incorrect behavior in production |
| P2 | Medium — Meaningful gap that reduces correctness, maintainability, or production-readiness |
| P3 | Low — Best practice improvement; low risk of real-world impact |

---

## P0 — Critical (Fix Before Any Production Deployment)

### P0-001: Add Server-Side Authentication to Admin API Routes

**Source:** SECURITY_AUDIT.md — P0 Critical  
**Files:** `src/app/api/admin/sources/fetch/route.ts`, `src/app/api/admin/geocode/route.ts`  
**Problem:** Both admin API routes have zero server-side authentication. Any public request
succeeds regardless of the caller's identity.

**Fix:**
```ts
// src/lib/api/require-admin.ts  [NEW FILE]
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin-config';

export async function requireAdmin(request: NextRequest): Promise<string | NextResponse> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.admin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    return decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
  }
}
```

Then in each route:
```ts
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result instanceof NextResponse) return result;
  const adminUid = result;
  // ... rest of route
}
```

**Also requires:** `src/lib/firebase/admin-config.ts` using `firebase-admin` SDK.  
**Client side:** Pass Firebase ID token in `Authorization: Bearer <token>` header from admin pages.

---

### P0-002: Remove or Gate `toggleDemoAdmin` in Production

**Source:** SECURITY_AUDIT.md — P0 Critical  
**File:** `src/context/AuthContext.tsx`, `src/app/admin/login/page.tsx`  
**Problem:** Demo admin toggle sets localStorage `soco_demo_admin=true` and grants admin UI access.
While API routes are unprotected (P0-001), this is a separate bypass vector.

**Fix:**
```ts
// In AuthContext.tsx, wrap toggleDemoAdmin to return no-op in production:
const toggleDemoAdmin = () => {
  if (process.env.NODE_ENV === 'production') {
    console.warn('Demo admin toggle is disabled in production.');
    return;
  }
  // ... existing logic
};
```

---

## P1 — High (Fix Before Launch)

### P1-001: Fix `applyAppearanceFilters()` to Not Read from Global Memory in Firestore Mode

**Source:** DATA_PERSISTENCE_AUDIT.md — P1 High  
**File:** `src/lib/db/store.ts`, lines 214–273  
**Problem:** City, cuisine, dietary, and search query filters use `memoryVendors`/`memoryVenues`
module globals — which are empty/stale in Firestore mode — to join against appearance results.

**Fix:** Pass vendors/venues as parameters instead of reading globals:
```ts
function applyAppearanceFilters(
  results: Appearance[],
  filter: AppearanceQueryFilter,
  vendors: Vendor[],   // <-- add parameter
  venues: Venue[]      // <-- add parameter
): Appearance[] {
  if (filter.city) {
    const venueIdsInCity = venues  // use parameter, not memoryVenues
      .filter(v => v.city.toLowerCase() === filter.city!.toLowerCase())
      .map(v => v.id);
    results = results.filter(a => venueIdsInCity.includes(a.venueId));
  }
  // ... similarly for cuisine, dietary, searchQuery
}
```

Update callers to pass the fetched vendor/venue lists.

---

### P1-002: Fix Admin Role Privilege Escalation via Self-Written Firestore Profile

**Source:** SECURITY_AUDIT.md — P1 High  
**File:** `src/context/AuthContext.tsx`, lines 86–90; `firestore.rules`  
**Problem:** Auth checks `profile.role === 'admin'` from user's own Firestore doc, which the
user can self-write.

**Fix (Option A — Recommended):** Use Firebase custom claims exclusively for admin determination:
```ts
const idTokenResult = await fbUser.getIdTokenResult();
const hasAdminClaim = Boolean(idTokenResult.claims.admin);
setIsAdmin(hasAdminClaim);  // Remove isRoleAdmin check entirely
```

**Fix (Option B):** Add Firestore rule to prevent self-modification of `role` field:
```
match /users/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow create: if request.auth != null && request.auth.uid == userId;
  allow update: if request.auth != null && request.auth.uid == userId
    && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role']);
}
```

---

### P1-003: Deploy Firestore Security Rules and Add `firebase.json`

**Source:** SECURITY_AUDIT.md — P1 High; DATA_PERSISTENCE_AUDIT.md — P2  
**Problem:** Security rules exist but have never been deployed. No `firebase.json` or `.firebaserc`.

**Fix:**
1. Create `firebase.json`:
```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

2. Create `.firebaserc`:
```json
{
  "projects": {
    "default": "<your-firebase-project-id>"
  }
}
```

3. Add to CI/CD or deployment docs: `firebase deploy --only firestore:rules,firestore:indexes`

---

### P1-004: Create `firestore.indexes.json` for Compound Queries

**Source:** DATA_PERSISTENCE_AUDIT.md — P2  
**Problem:** `fsGetPublicAppearances()` queries `isPublished + status + date` — a compound query
requiring a composite Firestore index. Without it, first production query fails.

**Fix:** Create `firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "appearances",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isPublished", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

---

### P1-005: Fix `data-map-ready` Set Before Tile Load Event

**Source:** MAP_AUDIT.md — P1 High  
**File:** `src/components/MapLibreMap.tsx`, lines 52–58  
**Problem:** `data-map-ready="true"` is set immediately after `Map()` constructor, before tiles load.

**Fix:**
```ts
// Remove early setMapReady(true) and data-map-ready setAttribute.
// Only set them inside the load event:
map.on('load', () => {
  setMapReady(true);
  mapContainerRef.current?.setAttribute('data-map-ready', 'true');
});
```

---

### P1-006: Document Production Tile and Geocoding Provider Requirements

**Source:** MAP_AUDIT.md — P1 High  
**Problem:** Defaults to Nominatim (1 req/s, no commercial use) and CARTO Free Tier.

**Fix:** Document in `README.md` the required production environment variables and acceptable
provider options. Update `.env.example` with comments noting rate limits and commercial restrictions.

---

### P1-007: Validate `source.url` Against SSRF Allowlist

**Source:** SECURITY_AUDIT.md — P2 (elevated to P1 given API is unauthenticated)  
**File:** `src/app/api/admin/sources/fetch/route.ts`, lines 71–77

**Fix:** Before fetch, validate URL:
```ts
const parsedUrl = new URL(source.url);
if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
  return NextResponse.json({ error: 'Only http/https URLs are permitted' }, { status: 400 });
}
const ipv4Private = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.)/;
if (ipv4Private.test(parsedUrl.hostname)) {
  return NextResponse.json({ error: 'Internal IP addresses are not permitted' }, { status: 400 });
}
```

---

## P2 — Medium (Fix Before or Shortly After Launch)

### P2-001: Fix Broken Observation ID Provenance Link

**Source:** INGESTION_PIPELINE_AUDIT.md — P2  
**Files:** `src/lib/ingestion/ai-extractor.ts` (line 118); `src/app/api/admin/sources/fetch/route.ts` (lines 154–168)  
**Problem:** The `obsId` generated in the extractor (`obs-${Date.now()}-${i}`) is embedded in
`candidate.observationIds`, but the observation actually saved in the route has a different ID.

**Fix:** Generate observation IDs externally and pass them into `extractScheduleCandidates()`,
or return them from the extraction function for use in the save loop.

---

### P2-002: Replace Regex HTML Parsing with Proper Parser

**Source:** INGESTION_PIPELINE_AUDIT.md — P2  
**File:** `src/app/api/admin/sources/fetch/route.ts`, lines 136–141

**Fix:** `npm install node-html-parser`, then:
```ts
import { parse } from 'node-html-parser';
const root = parse(responseText);
root.querySelectorAll('script, style').forEach(el => el.remove());
const normalizedText = root.innerText.replace(/\s+/g, ' ').trim();
```

---

### P2-003: Fix Hardcoded `adminUserId: 'admin-user'` in Audit Logs

**Source:** SECURITY_AUDIT.md — P2; FRONTEND_AUDIT.md  
**Files:** `src/app/admin/sources/page.tsx`, `src/app/admin/venues/page.tsx`

**Fix:** Pass real user UID from `useAuth()`:
```ts
const { user } = useAuth();
...
await addAuditLog({
  adminUserId: user?.uid || 'unknown',
  ...
});
```

---

### P2-004: Add Content Hash Deduplication to Ingestion Pipeline

**Source:** INGESTION_PIPELINE_AUDIT.md — P2  
**File:** `src/app/api/admin/sources/fetch/route.ts`

**Fix:** Before extraction, check the last successful SourceFetch for this source. If content
hash matches, skip extraction and return `{ skipped: true, reason: 'content_unchanged' }`.

---

### P2-005: Add Error State to Discovery Page Data Load

**Source:** FRONTEND_AUDIT.md — P2  
**File:** `src/app/page.tsx`

**Fix:** Add `const [error, setError] = useState<string | null>(null);` and set it in the
catch block. Render a distinct error state UI with a Retry button.

---

### P2-006: Fix `resolveRelativeDayOfWeek()` to Use LA Timezone Day-of-Week

**Source:** INGESTION_PIPELINE_AUDIT.md — P3 (elevated due to data correctness impact)  
**File:** `src/lib/ingestion/ai-extractor.ts`, lines 158–161

**Fix:**
```ts
const nowLA = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  weekday: 'short',
}).format(new Date());
const dayNameMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const currentDay = dayNameMap[nowLA] ?? new Date().getDay();
```

---

### P2-007: Rename `ai-extractor.ts` to Reflect Heuristic Implementation

**Source:** INGESTION_PIPELINE_AUDIT.md — P1  
**File:** `src/lib/ingestion/ai-extractor.ts`

**Fix:** Rename to `src/lib/ingestion/schedule-extractor.ts`. Update all imports. Update the
file comment to accurately describe it as a "heuristic text parser." This is a code clarity fix
that also sets the stage for adding real LLM extraction later without misleading developers.

---

## P3 — Low (Backlog)

| ID | Finding | File | Fix Summary |
|---|---|---|---|
| P3-001 | `data-map-ready` race with tile load | MAP_AUDIT.md | Fixed by P1-005 |
| P3-002 | Geocode cache is ephemeral | DATA_PERSISTENCE_AUDIT.md | Persist to Firestore/Redis |
| P3-003 | ResizeObserver without error boundary | MapLibreMap.tsx | Wrap `resize()` in try/catch |
| P3-004 | `flyTo` before map loaded | MapLibreMap.tsx | Guard with `map.loaded()` check |
| P3-005 | Candidate ID collision risk | ai-extractor.ts | Use `crypto.randomUUID()` |
| P3-006 | Vendor images from Unsplash hotlinks | seed data | Move to Firebase Storage for real data |
| P3-007 | ARIA hidden on mobile hidden map | page.tsx | Add `aria-hidden="true" inert` when hidden |
| P3-008 | vitest.config.ts ESM warning | vitest.config.ts | Add `"type": "module"` to package.json |
| P3-009 | No content deduplication by hash | fetch/route.ts | Fixed by P2-004 |
| P3-010 | `generateStaticParams()` for vendor pages | vendors/[slug]/page.tsx | Pre-render known vendor slugs |

---

## Repair Summary

| Priority | Count | Estimated Effort |
|---|---|---|
| P0 | 2 | 4–6 hours |
| P1 | 7 | 2–3 days |
| P2 | 7 | 2–3 days |
| P3 | 10 | 1–2 days (backlog) |

**Minimum for production deployment:** Complete all P0 and P1 items before any production launch.
