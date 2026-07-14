import { test, expect } from '@playwright/test';

/**
 * Auth flow — landing, modal, demo, redirect.
 * Selectors use role/class to stay resilient against copy tweaks.
 */

test('landing page loads with hero section', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.lp-hero')).toBeVisible();
  await expect(page).toHaveTitle(/Suimini/);
});

test('auth modal opens on login click', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Se connecter' }).first().click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
});

test('auth modal closes on overlay click', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Se connecter' }).first().click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  // ESC closes the modal
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="dialog"]')).not.toBeVisible();
});

test('demo mode starts and shows sample tree', async ({ page }) => {
  await page.goto('/');
  const demoBtn = page.getByRole('button', { name: /Essayer la démo/i }).first();
  await Promise.all([page.waitForURL('**/app'), demoBtn.click()]);
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText('Famille Dupont').first()).toBeVisible();
});

test('/app without session redirects to landing', async ({ page }) => {
  await page.goto('/app');
  await page.waitForURL((url) => url.pathname === '/');
  expect(new URL(page.url()).pathname).toBe('/');
});
