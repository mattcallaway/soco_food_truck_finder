# Frontend & UX Audit
**SoCo Food Truck Finder — Commit 39a5b0b — 2026-09-07**

---

## Overall Grade: **A-**

The frontend is well-architected with good component decomposition, responsive design, and a 
polished dark-mode aesthetic. Code quality is high. The primary concerns are client-side-only
data fetching from the main discovery page (reduces performance and SEO potential), a missing
error boundary for data load failures, and several accessibility gaps.

---

## Architecture Overview

```
src/app/
  page.tsx              → Discovery homepage (client component)
  admin/
    layout.tsx          → Admin shell + auth guard
    page.tsx            → Admin dashboard
    sources/page.tsx    → Source management
    venues/page.tsx     → Venue management
    appearances/page.tsx → Appearance management
    review-queue/page.tsx → Extraction candidate review
    audit/page.tsx      → Audit log viewer
    login/page.tsx      → Admin sign-in
  vendors/[slug]/page.tsx → Vendor profile (dynamic)
  venues/[slug]/page.tsx  → Venue profile (dynamic)
  favorites/page.tsx    → Saved favorites

src/components/
  MapLibreMap.tsx        → Interactive map
  VendorCard.tsx         → Discovery card
  FilterBar.tsx          → Search & filter controls
```

---

## Findings

### 🟡 P2 — MEDIUM: Discovery Page Uses Client-Side Data Fetching (SEO & Performance Impact)

**File:** `src/app/page.tsx`  
**Evidence:**

```tsx
'use client';

export default function DiscoveryPage() {
  const [appearances, setAppearances] = useState<Appearance[]>([]);
  ...
  useEffect(() => {
    async function loadData() { ... await getAppearances(filterArgs) ... }
    loadData();
  }, [dateView, ...]);
```

The discovery page is a `'use client'` component that fetches all data via `useEffect`. This means:
1. The initial HTML delivered to the browser contains no food truck data (blank skeleton)
2. Search engines cannot index food truck schedules (poor SEO for local discovery)
3. Data loads after initial paint — perceived performance is poor on slow connections

**Fix:** Convert the discovery page to a React Server Component for the initial static render,
using URL search params for filters. The map can remain a client island via `dynamic()` import
(already done). This would enable SSG/ISR for the schedule data.

---

### 🟡 P2 — MEDIUM: No Error Boundary for Discovery Data Load Failures

**File:** `src/app/page.tsx`, lines 105–108  
**Evidence:**

```ts
} catch (err) {
  console.error('Failed to load discovery data:', err);
} finally {
  setLoading(false);
}
```

If `getVendors()`, `getVenues()`, or `getAppearances()` throws (e.g., Firestore permissions error,
network timeout), the error is silently logged to the console. The user sees `0 found` with no
error message, no retry button, and no explanation. The empty-state UI (line 209) only renders
"No food trucks scheduled" with a filter reset button — not a data error message.

**Fix:** Add an explicit `error` state variable. Show a distinct UI when `error !== null` with
a descriptive message and a "Retry" button.

---

### 🟡 P2 — MEDIUM: `getAppearances()` Passes Filter Args but Demo Mode Filter Has Firestore Bug

**File:** `src/app/page.tsx`, lines 79–96  
**Evidence:**

```ts
const appList = await getAppearances(filterArgs);
```

The discovery page correctly passes all filter arguments to `getAppearances()`. However, as noted
in DATA_PERSISTENCE_AUDIT.md (P1 finding), `applyAppearanceFilters()` reads from global
`memoryVendors`/`memoryVenues` for city/cuisine/dietary filters. This bug only manifests in
Firestore mode and cannot be tested in the current demo environment.

---

### 🟡 P2 — MEDIUM: Vendor/Venue Profile Pages Are Server-Side Dynamic Routes

**File:** `src/app/vendors/[slug]/page.tsx`  
**Status:** VERIFIED WORKING  
**Evidence:** Build output shows `ƒ /vendors/[slug]` (Dynamic, server-rendered on demand).
These pages correctly use `generateMetadata()` for per-page SEO titles.

**Note (no issue):** These pages use server-side fetching and would benefit from `generateStaticParams()`
for pre-rendering known vendor slugs. This would eliminate per-request DB calls for each vendor page.

---

### 🟢 P3 — LOW: Missing Accessible Alt Texts for Dynamically Loaded Images

**File:** `src/components/VendorCard.tsx`  
**Evidence:** (Not audited in full — based on pattern observed in MapLibreMap popup):

Vendor hero images in popups use vendor name as alt text (e.g., `alt="${vendor.name}"`). This
is correct. However, VendorCard images should also verify that alt text is present for all
`<img>` elements with meaningful content.

---

### 🟢 P3 — LOW: Mobile List/Map Toggle Hides Map from DOM (Not ARIA-Hidden)

**File:** `src/app/page.tsx`, lines 258–270  
**Evidence:**

```tsx
<div className={`lg:col-span-5 ... ${mobileTab === 'list' ? 'hidden lg:block' : 'block'}`}>
  <MapLibreMap ... />
</div>
```

When `mobileTab === 'list'`, the map div gets `hidden` class. Screen readers may still traverse
the hidden MapLibre canvas. Should use `aria-hidden="true"` and `inert` attribute when hidden.

---

### 🟢 P3 — LOW: Admin `addAuditLog` Receives Literal `adminUserId: 'admin-user'`

**File:** `src/app/admin/sources/page.tsx`, line 46  
**Evidence:** (See SECURITY_AUDIT.md — P2 finding)

Not a UX issue, but a data quality issue visible in the Audit Log admin page.

---

## Verified Correctly Implemented

- ✅ Skeleton loading state with animated pulse on data load
- ✅ Empty state with "Reset All Filters" button
- ✅ MapLibre loaded via `next/dynamic` with `ssr: false` — avoids SSR window errors
- ✅ Mobile list/map tab toggle works correctly via `mobileTab` state
- ✅ Sticky map column with `lg:sticky lg:top-40` for desktop
- ✅ `handleSelectAppearance` syncs both map marker and card scroll position
- ✅ `openNowOnly` filter applied client-side using `isCurrentlyOpen()` (LA timezone)
- ✅ Admin layout redirects non-admin users to login
- ✅ Loading skeleton in admin layout (`animate-pulse` divs while `loading === true`)
- ✅ User geolocation requested on demand (not on page load)
- ✅ Error displayed when geolocation permission denied
- ✅ FilterBar includes city, cuisine, dietary, date view, search, and open-now controls
- ✅ `data-testid` attributes on key UI elements for E2E test targeting
- ✅ Demo seed data correctly marked `isDemo: true` in all entities

---

## Build Route Analysis

| Route | Type | SEO | Data Loading |
|---|---|---|---|
| `/` | Static shell (client-loaded data) | ❌ No schedule data in initial HTML | Client-side useEffect |
| `/admin/*` | Static shell (client-loaded data) | N/A (admin only) | Client-side useEffect |
| `/vendors/[slug]` | Dynamic server-rendered | ✅ generateMetadata | Server-side (per request) |
| `/venues/[slug]` | Dynamic server-rendered | ✅ Expected | Server-side (per request) |
| `/favorites` | Static shell | N/A | Client-side |
| `/api/admin/geocode` | Dynamic API | N/A | Server-side |
| `/api/admin/sources/fetch` | Dynamic API | N/A | Server-side |
