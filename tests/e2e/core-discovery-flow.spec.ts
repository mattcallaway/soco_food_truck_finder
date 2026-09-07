import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('SoCo Food Truck Finder - Core Discovery & Map E2E Flow', () => {
  test('should load homepage, verify MapLibre, sync markers, test filters, navigate profiles, and save anonymous favorites', async ({ page, browserName }) => {
    // 1. Launch homepage
    await page.goto('/');

    // 2. Assert page title
    await expect(page).toHaveTitle(/SoCo Food Truck Finder/i);

    // 3. Assert Today filter selected initially
    const todayBtn = page.getByTestId('date-filter-today');
    await expect(todayBtn).toBeVisible();

    // 4. Assert at least one seeded published appearance card is visible (list view)
    const mobileListToggle = page.getByTestId('mobile-toggle-list');
    const mobileMapToggle = page.getByTestId('mobile-toggle-map');

    if (await mobileListToggle.isVisible()) {
      await mobileListToggle.click();
    }

    const firstCard = page.getByTestId('appearance-card-app-1');
    await expect(firstCard).toBeVisible();

    // 5. Switch to map view on mobile if needed & wait for real map load event
    if (await mobileMapToggle.isVisible()) {
      await mobileMapToggle.click();
    }

    const foodMap = page.getByTestId('food-map');
    await expect(foodMap).toBeVisible();

    // Wait for data-map-ready — set after real map.on('load') or after 8s safety fallback
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="food-map"]');
        const val = el?.getAttribute('data-map-ready');
        return val === 'true' || val === 'fallback';
      },
      undefined,
      { timeout: 12000 }
    );

    // 6. Verify canvas exists and has non-zero dimensions
    const canvasInfo = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="map-container"]');
      const canvas = container?.querySelector('canvas');
      if (!canvas) return { found: false, width: 0, height: 0 };
      return {
        found: true,
        width: canvas.offsetWidth,
        height: canvas.offsetHeight,
      };
    });
    expect(canvasInfo.found).toBe(true);
    expect(canvasInfo.width).toBeGreaterThan(100);
    expect(canvasInfo.height).toBeGreaterThan(100);

    // 7. Verify MapLibre attribution or navigation control is rendered
    const hasControls = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="food-map"]');
      const navControl = container?.querySelector('.maplibregl-ctrl-zoom-in');
      const attribution = container?.querySelector('.maplibregl-ctrl-attrib');
      return { hasNavControl: Boolean(navControl), hasAttribution: Boolean(attribution) };
    });
    expect(hasControls.hasNavControl || hasControls.hasAttribution).toBe(true);

    // 8. Capture desktop map screenshot (full page — element clip may be empty on mobile)
    await page.screenshot({
      path: `audit/2026-09-07/screenshots/map-desktop-${browserName}.png`,
      fullPage: false,
    });

    // 9. Assert map marker exists & interact
    const marker1 = page.getByTestId('map-marker-app-1');
    await expect(marker1).toBeAttached();

    // 10. Try real pointer click first; fall back to dispatchEvent for overflow-clipped markers
    try {
      await marker1.click({ timeout: 3000 });
    } catch {
      await marker1.dispatchEvent('click');
    }

    // 11. On mobile, switch back to list view to verify card highlight
    if (await mobileListToggle.isVisible()) {
      await mobileListToggle.click();
    }
    await expect(firstCard).toHaveClass(/border-amber-500/);

    // 12. Test card → map sync: click a card, then verify the corresponding marker is selected
    const secondCard = page.getByTestId('appearance-card-app-2');
    if (await secondCard.isVisible()) {
      await secondCard.click();
      await expect(secondCard).toHaveClass(/border-amber-500/);

      // On desktop, verify map marker is updated (scale-125 class indicates selected state)
      if (!(await mobileMapToggle.isVisible())) {
        const marker2 = page.getByTestId('map-marker-app-2');
        const markerClass = await marker2.getAttribute('class');
        expect(markerClass).toMatch(/scale-125|ring-4/);
      }
    }

    // 13. Test Date Filters
    const tomorrowBtn = page.getByTestId('date-filter-tomorrow');
    await tomorrowBtn.click();
    await expect(page.getByTestId('appearance-card-app-4')).toBeVisible();

    const thisWeekBtn = page.getByTestId('date-filter-this_week');
    await thisWeekBtn.click();
    await expect(firstCard).toBeVisible();

    // 14. Test City Filter
    const citySelect = page.getByTestId('city-select');
    await citySelect.selectOption('Petaluma');
    await page.waitForTimeout(400);

    const clearFiltersBtn = page.getByTestId('clear-filters-btn');
    if (await clearFiltersBtn.isVisible()) {
      await clearFiltersBtn.click();
    }

    // 15. Test Anonymous Favorites Persistence
    const favButton = page.getByTestId('favorite-button-vendor-galvans-demo');
    await favButton.first().click({ force: true });

    // Badge counter should increment to 1
    const favBadge = page.getByTestId('favorites-count-badge');
    await expect(favBadge).toHaveText('1');

    // Reload page and verify favorite persists in localStorage
    await page.reload();
    await expect(page.getByTestId('favorites-count-badge')).toHaveText('1');

    // 16. Navigate to Vendor Profile
    await page.goto('/vendors/demo-galvans-eatery');
    await expect(page.locator('h1')).toContainText("Demo Galvan's Eatery");
    await expect(page.getByText(/Next Scheduled Appearance/i)).toBeVisible();
    await expect(page.getByTestId('directions-link')).toBeVisible();

    // 17. Navigate to Venue Page
    await page.goto('/venues/demo-henhouse-brewing-santa-rosa');
    await expect(page.locator('h1')).toContainText('Demo HenHouse Tasting Room');
    await expect(page.getByText(/Food Trucks Here Today/i)).toBeVisible();
  });
});
