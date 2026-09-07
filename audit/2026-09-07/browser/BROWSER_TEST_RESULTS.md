# Browser Test Evidence Report
**SoCo Food Truck Finder — Commit 39a5b0b — 2026-09-07**

---

## Final Automated Browser Test Run

**Command:** `npx playwright test --reporter=list`  
**Playwright Version:** Latest  
**Browsers:** Chromium (desktop), Mobile Chrome (viewport: 390×844)  
**App Mode:** `DATA_MODE=demo` (in-memory, no Firebase credentials)  
**Dev Server:** Running at `http://localhost:3000` (task-338)

---

## Test Results

```
Running 6 tests using 1 worker

  ok 1 [chromium] › tests\e2e\admin-review-queue.spec.ts — Admin Ingestion & Review Queue E2E Flow (3.6s)
  ok 2 [chromium] › tests\e2e\core-discovery-flow.spec.ts — Core Discovery & Map E2E Flow (4.5s)
  ok 3 [chromium] › tests\e2e\mobile-map-flow.spec.ts — Mobile Map / List Toggle Flow (1.4s)
  ok 4 [Mobile Chrome] › tests\e2e\admin-review-queue.spec.ts — Admin Ingestion & Review Queue E2E Flow (1.6s)
  ok 5 [Mobile Chrome] › tests\e2e\core-discovery-flow.spec.ts — Core Discovery & Map E2E Flow (5.2s)
  ok 6 [Mobile Chrome] › tests\e2e\mobile-map-flow.spec.ts — Mobile Map / List Toggle Flow (1.5s)

  6 passed (20.1s)
```

**Result: 6/6 PASS ✅**

---

## Test Coverage Detail

### Test 1 & 4: Admin Ingestion & Review Queue Flow

Steps verified:
- ✅ Navigate to `/admin/login`
- ✅ Demo admin toggle button visible and clickable
- ✅ Admin dashboard accessible after demo admin activation
- ✅ Sources admin page loads with "Ingestion Data Sources" heading
- ✅ Review queue page loads with "Human-in-the-Loop Review Queue" heading
- ✅ Appearances admin table page loads correctly

### Test 2 & 5: Core Discovery & Map E2E Flow

Steps verified:
- ✅ Page title contains "SoCo Food Truck Finder"
- ✅ Date filter "today" button is visible
- ✅ Appearance card `app-1` is visible in list view
- ✅ Food map container (`data-testid="food-map"`) is visible
- ✅ Map reports `data-map-ready="true"` within 15 seconds
- ✅ Map marker `map-marker-app-1` is attached to DOM
- ✅ Marker click (via dispatchEvent) selects the card (border-amber-500 class applied)
- ✅ Appearance card `app-2` selection works
- ✅ Tomorrow filter shows `appearance-card-app-4`
- ✅ This Week filter shows `appearance-card-app-1`
- ✅ City filter (Petaluma) changes results
- ✅ Clear filters restores results
- ✅ Anonymous favorite heart click increments badge counter to 1
- ✅ Favorites persist across page reload (localStorage)
- ✅ Vendor profile `/vendors/demo-galvans-eatery` renders with vendor name
- ✅ "Next Scheduled Appearance" section visible on vendor profile
- ✅ Directions link visible on vendor profile
- ✅ Venue page `/venues/demo-henhouse-brewing-santa-rosa` renders correctly
- ✅ "Food Trucks Here Today" section visible on venue page

### Test 3 & 6: Mobile Map / List Toggle Flow

Steps verified:
- ✅ Mobile list view toggle visible
- ✅ Mobile map view toggle visible
- ✅ Switching to map view renders food-map container
- ✅ Map tiles do not produce blank container (visual assertion via data-map-ready)
- ✅ Switching back to list view shows vendor cards

---

## Map Verification Notes

The E2E tests verify the following map behaviors:

| Assertion | Method | Result |
|---|---|---|
| Map container renders | `toBeVisible()` on `[data-testid="food-map"]` | ✅ PASS |
| Map reports ready | `toHaveAttribute('data-map-ready', 'true')` | ✅ PASS |
| Markers attached to DOM | `toBeAttached()` on `[data-testid="map-marker-app-1"]` | ✅ PASS |
| Marker click triggers selection | `dispatchEvent('click')` + card class assertion | ✅ PASS |
| Map tile visual rendering | Not asserted (no screenshot comparison) | ⚠️ NOT VERIFIED |

**Note on Map Testing Approach:**  
MapLibre GL JS markers exist inside an `overflow: hidden` container. Playwright's `toBeVisible()`
requires the element to be within the viewport. Map markers can be positioned at geographic
coordinates that place them outside the visible container clip. For this reason, markers are
tested with `toBeAttached()` (DOM presence) and interactions use `dispatchEvent('click')` rather
than `click()`. This verifies DOM correctness but does NOT assert visual tile rendering.

To fully verify visual map rendering, screenshot comparison tests with a stable visual baseline
would be required (see REPAIR_PLAN.md P3-level item).

---

## Console Errors During Test Run

No critical JavaScript errors were observed during test runs. MapLibre GL JS may log:
- Tile load network warnings (non-fatal) — suppressed by `map.on('error', console.warn)`

---

## Browser Test Matrix

| Browser | Viewport | Tests | Pass | Fail |
|---|---|---|---|---|
| Chromium | Desktop (1280×720) | 3 | 3 | 0 |
| Mobile Chrome | 390×844 | 3 | 3 | 0 |
| Firefox | — | Not configured | — | — |
| Safari / WebKit | — | Not configured | — | — |

Firefox and WebKit coverage is recommended before production deployment.
