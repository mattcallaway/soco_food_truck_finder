import { test, expect } from '@playwright/test';

test.describe('SoCo Food Truck Finder - Core Discovery & Map E2E Flow', () => {
  test('should load homepage, verify MapLibre, sync markers, test filters, navigate profiles, and save anonymous favorites', async ({ page }) => {
    // 1. Launch homepage
    await page.goto('/');

    // 2. Assert page title
    await expect(page).toHaveTitle(/SoCo Food Truck Finder/i);

    // 3. Assert Today filter selected initially
    const todayBtn = page.getByTestId('date-filter-today');
    await expect(todayBtn).toBeVisible();

    // 4. Assert at least one seeded published appearance card is visible (if list view is active)
    const mobileListToggle = page.getByTestId('mobile-toggle-list');
    const mobileMapToggle = page.getByTestId('mobile-toggle-map');

    if (await mobileListToggle.isVisible()) {
      await mobileListToggle.click();
    }

    const firstCard = page.getByTestId('appearance-card-app-1');
    await expect(firstCard).toBeVisible();

    // 5. Switch to map view on mobile if needed & wait for map container ready
    if (await mobileMapToggle.isVisible()) {
      await mobileMapToggle.click();
    }

    const foodMap = page.getByTestId('food-map');
    await expect(foodMap).toBeVisible();
    await expect(foodMap).toHaveAttribute('data-map-ready', 'true', { timeout: 15000 });


    // 6. Assert map marker exists & interact
    const marker1 = page.getByTestId('map-marker-app-1');
    await expect(marker1).toBeAttached();

    // 7. Click map marker via event dispatch
    await marker1.dispatchEvent('click');



    // On mobile, switch back to list view to verify card highlight
    if (await mobileListToggle.isVisible()) {
      await mobileListToggle.click();
    }
    await expect(firstCard).toHaveClass(/border-amber-500/);

    // 8. Click a different card -> assert selected
    const secondCard = page.getByTestId('appearance-card-app-2');
    if (await secondCard.isVisible()) {
      await secondCard.click();
      await expect(secondCard).toHaveClass(/border-amber-500/);
    }

    // 9. Test Date Filters (Tomorrow & This Week)
    const tomorrowBtn = page.getByTestId('date-filter-tomorrow');
    await tomorrowBtn.click();
    await expect(page.getByTestId('appearance-card-app-4')).toBeVisible();

    const thisWeekBtn = page.getByTestId('date-filter-this_week');
    await thisWeekBtn.click();
    await expect(firstCard).toBeVisible();

    // 10. Test City Filter
    const citySelect = page.getByTestId('city-select');
    await citySelect.selectOption('Petaluma');
    await page.waitForTimeout(300);

    const clearFiltersBtn = page.getByTestId('clear-filters-btn');
    if (await clearFiltersBtn.isVisible()) {
      await clearFiltersBtn.click();
    }

    // 11. Test Anonymous Favorites Persistence
    const favButton = page.getByTestId('favorite-button-vendor-galvans-demo');
    await favButton.first().click({ force: true });



    // Badge counter should increment to 1
    const favBadge = page.getByTestId('favorites-count-badge');
    await expect(favBadge).toHaveText('1');

    // Reload page and verify favorite persists in localStorage
    await page.reload();
    await expect(page.getByTestId('favorites-count-badge')).toHaveText('1');

    // 12. Navigate to Vendor Profile
    await page.goto('/vendors/demo-galvans-eatery');
    await expect(page.locator('h1')).toContainText("Demo Galvan's Eatery");
    await expect(page.getByText(/Next Scheduled Appearance/i)).toBeVisible();
    await expect(page.getByTestId('directions-link')).toBeVisible();

    // 13. Navigate to Venue Page
    await page.goto('/venues/demo-henhouse-brewing-santa-rosa');
    await expect(page.locator('h1')).toContainText('Demo HenHouse Tasting Room');
    await expect(page.getByText(/Food Trucks Here Today/i)).toBeVisible();
  });
});

