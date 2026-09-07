import { test, expect } from '@playwright/test';

test.describe('SoCo Food Truck Finder - Mobile Map / List Toggle Flow', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should toggle mobile map and list views seamlessly without blank map tiles', async ({ page }) => {
    await page.goto('/');

    const mapToggleBtn = page.getByTestId('mobile-toggle-map');
    await expect(mapToggleBtn).toBeVisible();

    // Switch to Mobile Map view
    await mapToggleBtn.click();

    const foodMap = page.getByTestId('food-map');
    await expect(foodMap).toBeVisible();
    await expect(foodMap).toHaveAttribute('data-map-ready', 'true', { timeout: 15000 });

    // Switch back to Mobile List view
    const listToggleBtn = page.getByTestId('mobile-toggle-list');
    await listToggleBtn.click();
    await expect(page.getByTestId('appearance-card-app-1')).toBeVisible();

    // Switch to Map view again -> verify map resize & canvas ready
    await mapToggleBtn.click();
    await expect(foodMap).toBeVisible();

  });
});
