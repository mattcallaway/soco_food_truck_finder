# Map & Geospatial Audit
**SoCo Food Truck Finder — Commit 39a5b0b — 2026-09-07**

---

## Overall Grade: **B**

The MapLibre GL JS integration is well-implemented with proper lifecycle management, marker
synchronization, popup rendering, fly-to animation, and an accessible error fallback. The primary
concerns are: tile/geocoding providers are public/rate-limited services, the `data-map-ready`
flag is set *before* the map actually loads tiles (race condition), and E2E tests verify
DOM attachment but not visual rendering.

---

## Component Summary

**File:** `src/components/MapLibreMap.tsx`  
**Library:** `maplibre-gl` (open source MapLibre GL JS)  
**Tile Provider:** CARTO Positron GL style (configurable via `NEXT_PUBLIC_MAP_TILE_URL`)  
**Geocoding:** Nominatim (OSM) via `/api/admin/geocode` server-side proxy  

---

## Findings

### 🟠 P1 — HIGH: `data-map-ready` Set Before Map Tiles Load

**File:** `src/components/MapLibreMap.tsx`, lines 52–58  
**Evidence:**

```ts
const map = new maplibregl.Map({...});
map.addControl(new maplibregl.NavigationControl(), 'top-right');

setMapReady(true);                           // ← set here (map created, no tiles)
if (mapContainerRef.current) {
  mapContainerRef.current.setAttribute('data-map-ready', 'true');  // ← set here
}

map.on('load', () => {
  setMapReady(true);                         // ← also set on load (redundant)
});
```

The `data-map-ready` attribute is set immediately after the `Map` constructor, before tiles
have loaded. Playwright tests that wait for `[data-map-ready="true"]` may proceed before the
map canvas is actually rendered with any tile imagery.

**Impact:** Tests can falsely pass; users may see blank tiles momentarily (or permanently on slow
connections) but the app reports itself as ready.

**Fix:** Set `data-map-ready` only inside the `map.on('load', ...)` callback:
```ts
map.on('load', () => {
  setMapReady(true);
  mapContainerRef.current?.setAttribute('data-map-ready', 'true');
});
```

---

### 🟠 P1 — HIGH: Tile and Geocoding Providers Are Public Rate-Limited Services

**File:** `src/config/app-config.ts`, lines 11–17  
**Evidence:**

```ts
mapTileUrl: process.env.NEXT_PUBLIC_MAP_TILE_URL ||
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
geocodingApiUrl: process.env.GEOCODING_API_URL ||
  'https://nominatim.openstreetmap.org/search',
```

Default tile provider: **CARTO Free Tier** — limited to a non-commercial use policy with no SLA.  
Default geocoding provider: **Nominatim (OSM)** — limited to 1 request/second, no bulk use,
requires valid `User-Agent` and is prohibited for production commercial use.

The code correctly sets a `User-Agent` for geocoding requests. However, for a production food
truck finder application with concurrent users, tile requests through the CARTO free tier and
Nominatim geocoding will be insufficient.

**Fix:** Document production requirements. Options:
- Tiles: MapTiler Cloud (free tier: 100k tiles/month), Maptiler GL, or self-hosted tiles with PMTiles
- Geocoding: Geocod.io (Sonoma County-specific), Mapbox Geocoding API (free tier), or Pelias self-hosted

---

### 🟡 P2 — MEDIUM: Playwright Map Tests Use DOM-Attachment Instead of Visual Assertions

**File:** `tests/e2e/core-discovery-flow.spec.ts`  
**Evidence:** The E2E tests were patched (per previous sprint notes) to use `toBeAttached()` and
`dispatchEvent('click')` for marker interaction because MapLibre markers inside
`overflow: hidden` containers cannot be guaranteed to be within the Playwright viewport.

This means:
- Map existence: **VERIFIED** (DOM rendered)  
- Map tile visual rendering: **NOT VERIFIED** (no screenshot assertion)
- Marker visual appearance: **NOT VERIFIED** (attached to DOM but visibility uncertain)
- Popup visual rendering: **NOT VERIFIED**

**Fix:** Add Playwright screenshot assertions for the map area. Use
`await expect(page).toHaveScreenshot('map-with-markers.png')` with a visual baseline.

---

### 🟡 P2 — MEDIUM: `flyTo` Called Even When Map Not Fully Loaded

**File:** `src/components/MapLibreMap.tsx`, lines 151–168  
**Evidence:**

```ts
useEffect(() => {
  if (!selectedAppearanceId || !mapRef.current) return;
  ...
  mapRef.current.flyTo({ center: [venue.lng, venue.lat], zoom: 14, speed: 1.2 });
```

If a user selects an appearance before the map has finished loading (before `map.on('load')` fires),
the `flyTo` call will throw: `"Map is not yet loaded. Use the 'load' event."` This is caught by
the `map.on('error', ...)` handler (line 61) only if it bubbles as a map error. `flyTo` before
load can cause a silent failure.

**Fix:** Guard the `flyTo` call with `if (mapRef.current.loaded()) { ... }` or queue the flyTo
for after the `load` event.

---

### 🟢 P3 — LOW: Popup Renders Vendor `heroImage` from Unsplash CDN

**File:** `src/components/MapLibreMap.tsx`, lines 122–127  
**Evidence:**

```ts
const popupHtml = `
  <div>
    ${vendor?.heroImage
      ? `<img src="${vendor.heroImage}" alt="${vendor.name}" .../>`
      : ''}
    ...
```

Vendor hero images are sourced from Unsplash (`https://images.unsplash.com/...`). These are
hardcoded in the demo seed data. In production with real vendor data, images should be hosted
in Firebase Storage or another controlled CDN — not direct Unsplash URLs.

**Fix:** When seeding real vendors, store images in Firebase Storage and use their gs:// or
HTTPS Storage URLs, not third-party CDN hotlinks.

---

### 🟢 P3 — LOW: ResizeObserver Without Error Boundary

**File:** `src/components/MapLibreMap.tsx`, lines 76–84  
**Evidence:**

```ts
const resizeObserver = new ResizeObserver(() => {
  if (mapRef.current) {
    mapRef.current.resize();
  }
});
```

`ResizeObserver` callbacks that throw unhandled errors can produce loop-detected errors in some
browsers. No error boundary wraps the resize callback.

**Fix:** Wrap in try/catch: `try { mapRef.current?.resize(); } catch(e) { /* ignore */ }`.

---

## Verified Correctly Implemented

- ✅ MapLibre GL JS initialized with configurable style URL
- ✅ `APP_CONFIG.mapTileUrl` is environment-variable driven (not hardcoded to CARTO)
- ✅ `APP_CONFIG.geocodingApiUrl` is environment-variable driven (not hardcoded to Nominatim)
- ✅ Markers clear and re-render when `appearances` prop changes
- ✅ Selected marker scales up (125%) and opens popup automatically
- ✅ `flyTo()` animates map to selected appearance's venue coordinates
- ✅ `ResizeObserver` calls `map.resize()` to fix blank tiles on container resize
- ✅ Error fallback shows "Map View Temporarily Unavailable" with a Retry button
- ✅ `data-testid="food-map"` and `data-testid="map-marker-{id}"` support E2E testing
- ✅ Navigation controls added via `maplibregl.NavigationControl()`
- ✅ Map cleanup runs on component unmount (`mapRef.current.remove()`)
- ✅ Popup content shows vendor name, venue name, city, and time range
