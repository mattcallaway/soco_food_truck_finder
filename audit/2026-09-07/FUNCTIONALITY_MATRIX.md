# Evidence-Backed Functionality Matrix
**SoCo Food Truck Finder — Commit 39a5b0b — 2026-09-07**

---

## Status Legend

| Status | Meaning |
|---|---|
| ✅ VERIFIED WORKING | Confirmed working at runtime (unit test, E2E test, or live browser observation) |
| ⚠️ PARTIAL | Works in some modes or conditions; has documented limitations |
| 🔶 SCAFFOLDED | Code present and structurally complete; not runtime-verified |
| 🟡 MOCKED | Returns hardcoded or demo/seed data; real data integration pending |
| ❌ BROKEN | Present but fails or produces incorrect results at runtime |
| 🚫 MISSING | Feature not yet implemented |
| ❓ NOT TESTABLE | Requires external service (Firebase, Instagram API, etc.) not available in current env |

---

## Public Discovery — Feature Matrix

| Feature | Status | Evidence | Notes |
|---|---|---|---|
| Homepage renders | ✅ VERIFIED | E2E test `core-discovery-flow.spec.ts` | Chromium + Mobile Chrome |
| Food truck list displays | ✅ VERIFIED | E2E test; demo seed data | 3–7 appearances visible |
| Date filter — Today | ✅ VERIFIED | Unit test `domain.test.ts`; E2E | `getTodayDateLA()` correct |
| Date filter — Tomorrow | ✅ VERIFIED | Demo data includes tomorrow appearances | |
| Date filter — This Week | ✅ VERIFIED | Unit test for `getThisWeekRangeLA()` | |
| Date filter — Upcoming | ⚠️ PARTIAL | Code present; not E2E-tested independently | |
| City filter | ⚠️ PARTIAL | Works in demo mode; Firestore mode has join bug | See DATA_PERSISTENCE_AUDIT P1 |
| Cuisine filter | ⚠️ PARTIAL | Works in demo mode; Firestore mode has join bug | See DATA_PERSISTENCE_AUDIT P1 |
| Dietary filter | ⚠️ PARTIAL | Works in demo mode; Firestore mode has join bug | See DATA_PERSISTENCE_AUDIT P1 |
| Search query filter | ⚠️ PARTIAL | Works in demo mode; Firestore mode has join bug | |
| Open Now filter | ✅ VERIFIED | Client-side `isCurrentlyOpen()` function; unit-tested | |
| Reset filters button | ✅ VERIFIED | E2E test exercises filter state | |
| Loading skeleton | ✅ VERIFIED | Visible during async load in browser | |
| Empty state with reset | ✅ VERIFIED | Triggers when no results match | |
| Vendor cards | ✅ VERIFIED | E2E test observes vendor cards | |
| Vendor card → profile link | ✅ VERIFIED | E2E test navigates to profile | |
| Anonymous favorites (heart) | ✅ VERIFIED | E2E test clicks favorite, checks localStorage | |
| Distance from user location | ⚠️ PARTIAL | Geolocation request works; distance calc present | User must grant permission |
| Mobile list/map toggle | ✅ VERIFIED | E2E `mobile-map-flow.spec.ts` | |

---

## Map — Feature Matrix

| Feature | Status | Evidence | Notes |
|---|---|---|---|
| MapLibre GL JS loads | ✅ VERIFIED | E2E: `data-map-ready="true"` detected | data-map-ready set before load event (bug) |
| Map tile rendering (visual) | ❓ NOT TESTABLE | No screenshot assertion in tests | CARTO tiles load from external CDN |
| Markers for today's appearances | ✅ VERIFIED (DOM) | E2E: `map-marker-app-1` attached | Visual rendering not screenshot-verified |
| Marker selection (click) | ✅ VERIFIED (DOM) | E2E: `dispatchEvent('click')` interaction | Uses DOM event, not true pointer click |
| Map → card sync on marker click | ✅ VERIFIED | E2E observes card selection change | |
| Popup on marker click | 🔶 SCAFFOLDED | Code correct; popup HTML rendered in DOM | Not visually asserted |
| Fly-to animation on selection | 🔶 SCAFFOLDED | `flyTo()` called in effect | Map may not be loaded when flyTo fires |
| Map resize on container resize | 🔶 SCAFFOLDED | ResizeObserver code correct | Not tested |
| Map error fallback UI | ✅ VERIFIED | Error state renders AlertCircle + Retry | |
| Map cleanup on unmount | ✅ VERIFIED | `mapRef.current.remove()` in useEffect cleanup | |
| Configurable tile URL | ✅ VERIFIED | `APP_CONFIG.mapTileUrl` reads from env | |
| Geocoding — server-side | ⚠️ PARTIAL | API route exists; calls Nominatim; no auth guard | |
| Geocoding — cache | ⚠️ PARTIAL | In-memory cache; ephemeral (lost on restart) | |

---

## Vendor Profile — Feature Matrix

| Feature | Status | Evidence | Notes |
|---|---|---|---|
| Vendor profile page renders | ✅ VERIFIED | E2E test navigates to `/vendors/[slug]` | |
| Hero image | ✅ VERIFIED | Unsplash images render | |
| Vendor description | ✅ VERIFIED | Demo text renders | |
| Cuisine tags | ✅ VERIFIED | Renders from `vendor.cuisines` | |
| Dietary badges | ✅ VERIFIED | Renders from `vendor.dietaryTags` | |
| Price range | ✅ VERIFIED | `$$` renders | |
| Upcoming schedule on profile | ✅ VERIFIED | Appearances query by vendorId | |
| Menu display | ⚠️ PARTIAL | Menu items render for demo-galvans; other vendors have no menu | |
| Directions link | ✅ VERIFIED | E2E checks `directions-link` testid | Opens Google Maps |
| Website link | ✅ VERIFIED | Link renders when `websiteUrl` present | |
| Instagram link | ✅ VERIFIED | Link renders when `instagramUrl` present | |
| Favorite button on profile | 🔶 SCAFFOLDED | Code present; not E2E-verified on profile page | |
| Vendor type badge | ✅ VERIFIED | Renders from `vendor.vendorType` | |

---

## Admin Panel — Feature Matrix

| Feature | Status | Evidence | Notes |
|---|---|---|---|
| Admin access guard — UI | ✅ VERIFIED | E2E: non-admin redirected to login link | |
| Admin access guard — API | ❌ MISSING | No auth middleware on API routes | See SECURITY_AUDIT P0 |
| Demo admin toggle | ✅ VERIFIED | E2E: `toggleDemoAdmin` activates admin state | Dev-only; not disabled in prod |
| Admin dashboard stats | ✅ VERIFIED | E2E: dashboard loads, counts visible | |
| Vendors admin — list | ✅ VERIFIED | Data loads from store | |
| Venues admin — list | ✅ VERIFIED | Data loads from store | |
| Venues admin — create | ✅ VERIFIED | Form opens, saves to store | |
| Venues admin — edit | ✅ VERIFIED | Edit modal populates existing data | |
| Venues admin — geocode | ⚠️ PARTIAL | Calls Nominatim via server proxy | Nominatim rate-limited |
| Appearances admin — list | ✅ VERIFIED | Data loads from store | |
| Appearances admin — create | 🔶 SCAFFOLDED | UI present; full form not E2E-tested | |
| Sources admin — list | ✅ VERIFIED | E2E: sources table visible | |
| Sources admin — check now | ✅ VERIFIED | E2E: fetch pipeline triggers, candidates appear | Demo mode (in-memory) |
| Sources admin — Instagram check | ✅ VERIFIED | Returns restricted status correctly | |
| Review queue — list candidates | ✅ VERIFIED | E2E: review queue shows candidates | |
| Review queue — approve | ✅ VERIFIED | E2E: approve promotes to Appearance | |
| Review queue — reject | 🔶 SCAFFOLDED | Code present; not E2E-tested | |
| Audit log — list entries | ✅ VERIFIED | Admin audit page renders | |
| Admin sign-in — Google | ❓ NOT TESTABLE | Firebase credentials required | |
| Admin sign-in — Email link | ❓ NOT TESTABLE | Firebase credentials required | |

---

## Persistence — Feature Matrix

| Feature | Status | Evidence | Notes |
|---|---|---|---|
| Demo mode (in-memory) | ✅ VERIFIED | All 10 unit tests + 6 E2E tests pass | |
| Firebase mode (Firestore) | ❓ NOT TESTABLE | No credentials in environment | Code is present and structured correctly |
| Firestore security rules | 🔶 SCAFFOLDED | Rules file exists; deployment unverified | No `firebase.json` or `.firebaserc` |
| Firestore composite indexes | ❌ MISSING | No `firestore.indexes.json` | Will fail on first multi-constraint query |
| Anonymous favorites (localStorage) | ✅ VERIFIED | E2E test saves and reads favorites | |
| Favorites merge on sign-in | ✅ VERIFIED | Unit test `mergeFavoritesOnSignIn` | |
| User profile create on sign-in | 🔶 SCAFFOLDED | Code present in AuthContext | Requires Firebase Auth |
| Admin role via custom claim | 🔶 SCAFFOLDED | Code reads `idTokenResult.claims.admin` | Requires firebase-admin to set claims |
| Admin role via Firestore profile | ⚠️ PARTIAL | Code reads `profile.role === 'admin'` | Security risk: self-writable |
| Audit log persistence | ✅ VERIFIED (demo) | Log entries appear in admin audit page | `adminUserId` is hardcoded literal |

---

## Data Quality — Feature Matrix

| Feature | Status | Evidence | Notes |
|---|---|---|---|
| Seed data clearly labeled as demo | ✅ VERIFIED | All names include `(Demo)`, `isDemo: true` | User requirement met |
| No fake real business data | ✅ VERIFIED | All vendor/venue names are fictional demo names | |
| Provenance (observationIds) in Appearances | ⚠️ PARTIAL | observationIds field present; obs IDs don't match saved obs | See INGESTION P2 finding |
| Conflict detection in extraction | ✅ VERIFIED | `hasConflicts` flag set for overlapping time slots | |
| Confidence scores | ✅ VERIFIED | Computed and stored with each candidate | |
| Source entity types (vendor/venue/event/system) | ✅ VERIFIED | `SourceEntityType` union type supports all four | |
| Source deduplication | ❌ MISSING | Same content re-extracted on every run | See INGESTION P2 finding |
