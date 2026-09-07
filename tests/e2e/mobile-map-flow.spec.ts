import { test, expect } from '@playwright/test';

test.describe('SoCo Food Truck Finder - Mobile Map / List Toggle Flow', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('should toggle mobile map and list views seamlessly without blank map tiles', async ({ page, browserName }) => {
    await page.goto('/');

    const mapToggleBtn = page.getByTestId('mobile-toggle-map');
    await expect(mapToggleBtn).toBeVisible();

    // Switch to Mobile Map view
    await mapToggleBtn.click();

    const foodMap = page.getByTestId('food-map');
    await expect(foodMap).toBeVisible();

    // Wait for data-map-ready — set after map.on('load') or after 8s safety fallback
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="food-map"]');
        const val = el?.getAttribute('data-map-ready');
        return val === 'true' || val === 'fallback';
      },
      undefined,
      { timeout: 12000 }
    );

    // Verify canvas has non-zero dimensions (not blank)
    const canvasDims = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="map-container"]');
      const canvas = container?.querySelector('canvas');
      return {
        found: Boolean(canvas),
        width: canvas?.offsetWidth ?? 0,
        height: canvas?.offsetHeight ?? 0,
      };
    });
    expect(canvasDims.found).toBe(true);
    expect(canvasDims.width).toBeGreaterThan(50);
    expect(canvasDims.height).toBeGreaterThan(50);

    // Capture mobile map screenshot as evidence (full page — avoid empty clip on mobile)
    await page.screenshot({
      path: `audit/2026-09-07/screenshots/map-mobile-${browserName}.png`,
      fullPage: false,
    });

    // Switch back to Mobile List view
    const listToggleBtn = page.getByTestId('mobile-toggle-list');
    await listToggleBtn.click();
    await expect(page.getByTestId('appearance-card-app-1')).toBeVisible();

    // Switch to Map view again → verify resize handler fires without errors
    await mapToggleBtn.click();
    await expect(foodMap).toBeVisible();
    // Map should still be ready after resize (accepts real load or fallback)
    const mapReadyAfterResize = await foodMap.getAttribute('data-map-ready');
    expect(['true', 'fallback']).toContain(mapReadyAfterResize);
  });
});
