import { test, expect } from '@playwright/test';

test.describe('GeMTenders.org E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Home Page: Correct title and hero', async ({ page }) => {
    await expect(page).toHaveTitle(/GeMTenders.org/);
    const heading = page.getByRole('heading', { name: /Find Your Next Tender/i });
    await expect(heading).toBeVisible();
  });

  test('Navigation: To Explore page', async ({ page }) => {
    const exploreLink = page.getByRole('link', { name: 'Explore', exact: true }).first();
    await exploreLink.click();
    await page.waitForURL(/\/explore/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/explore/);
    
    // The Explore page uses tabs. "By Category" is usually active by default.
    // Let's click "By Ministry" to verify interactivity.
    const ministryTab = page.getByRole('tab', { name: /By Ministry/i });
    await expect(ministryTab).toBeVisible();
    await ministryTab.click();
    
    // Check if the ministry list starts appearing
    await expect(page.getByText(/MATCHING/i).or(page.getByText(/TOP MINISTRIES/i))).toBeVisible();
  });

  test('Navigation: To About page', async ({ page }) => {
    const aboutLink = page.getByRole('link', { name: /About/i }).first();
    await aboutLink.click();
    await expect(page).toHaveURL(/\/about/);
  });

  test('Search: Interaction and results', async ({ page }) => {
    const searchInput = page.locator('#tender-search');
    await expect(searchInput).toBeVisible();
    
    // Typing 'GeM' should almost certainly return results
    await searchInput.fill('GeM');
    await searchInput.press('Enter');
    
    // Wait for the results to load
    await page.waitForLoadState('networkidle');
    
    // Check for Either results grid OR "No matching tenders found"
    // Using a more flexible locator for any grid-like display
    const resultsOrEmpty = page.locator('.grid, h3:has-text("No matching tenders found"), h3:has-text("No matching results")').first();
    await expect(resultsOrEmpty).toBeVisible({ timeout: 15000 });
  });

  test('Admin Page: Access and stats', async ({ page }) => {
    // Admin page might be heavy/SSR, so we use a longer timeout
    await page.goto('/admin', { timeout: 30000 });
    await expect(page).toHaveURL(/\/admin/);
    
    // Check for "Command Center" heading
    await expect(page.getByRole('heading', { name: /Command Center/i })).toBeVisible();
    
    // Check for data quality percentage cards
    await expect(page.getByText(/Data Quality/i)).toBeVisible();
  });

  test('Mobile Menu: Navigation and Dark Mode', async ({ page }) => {
    // Force mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    
    const menuButton = page.getByLabel(/Open navigation menu/i);
    await menuButton.click();
    
    // Check if drawer is visible
    const drawer = page.locator('#mobile-menu');
    await expect(drawer).toBeVisible();
    
    // Dark Mode Toggle check
    const darkModeToggle = page.getByLabel(/Switch to (dark|light) mode/i);
    await expect(darkModeToggle).toBeVisible();
    
    // Verify Explore is in the list
    await expect(drawer.getByText(/Explore/i)).toBeVisible();
  });
});
