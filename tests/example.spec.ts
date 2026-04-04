import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // The application title should follow the name geMTenders.org
  await expect(page).toHaveTitle(/GeMTenders.org/);
});

test('check search visibility', async ({ page }) => {
  await page.goto('/');

  // Basic check for layout stability — waiting for the logo or main text
  // logos should appear shortly after load.
  const logo = page.getByText(/GeMTenders/i).first();
  await expect(logo).toBeVisible({ timeout: 15000 });
});
