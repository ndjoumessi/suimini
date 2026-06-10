import { test, expect } from '@playwright/test';

/**
 * Dashboard — message de bienvenue et statistiques de l'arbre démo.
 * Viewport mobile pour accéder au BottomNav.
 */

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  const demoBtn = page.getByRole('button', { name: /Essayer la démo/i }).first();
  await Promise.all([page.waitForURL('**/app'), demoBtn.click()]);
});

test('dashboard shows a greeting', async ({ page }) => {
  await expect(page.locator('body')).toContainText('Bonjour');
});

test('dashboard stats include the 13 demo persons', async ({ page }) => {
  await expect(page.locator('body')).toContainText('13');
});

test('dashboard shows the demo tree name', async ({ page }) => {
  await expect(page.getByText('Famille Dupont').first()).toBeVisible();
});

test('CTA navigates to tree view via BottomNav', async ({ page }) => {
  const bottomNav = page.locator('nav[aria-label="Navigation mobile"]');
  await bottomNav.getByRole('button', { name: 'Arbre' }).click();
  await expect(bottomNav.getByRole('button', { name: 'Arbre' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});
