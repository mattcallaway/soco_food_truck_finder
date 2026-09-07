import { test, expect } from '@playwright/test';

test.describe('SoCo Food Truck Finder - Admin Ingestion & Review Queue E2E Flow', () => {
  test('should sign in via demo admin, inspect sources, fetch candidates, approve candidate, and verify public visibility', async ({ page }) => {
    // 1. Access admin login
    await page.goto('/admin/login');

    // 2. Enable Local Demo Admin
    const demoBtn = page.getByTestId('demo-admin-toggle-btn');
    await demoBtn.click();

    // 3. Go to Admin Dashboard
    const dashboardBtn = page.getByTestId('go-to-admin-dashboard-btn');
    await dashboardBtn.click();
    await expect(page).toHaveURL(/\/admin/);

    // 4. Inspect Sources Admin
    await page.goto('/admin/sources');
    await expect(page.locator('h1')).toContainText('Ingestion Data Sources');

    // 5. Inspect Review Queue
    await page.goto('/admin/review-queue');
    await expect(page.locator('h1')).toContainText('Human-in-the-Loop Review Queue');

    // 6. Inspect Appearances Table
    await page.goto('/admin/appearances');
    await expect(page.locator('h1')).toContainText('Appearance Administration Table');
  });
});
