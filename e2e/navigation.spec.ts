import { test, expect } from '@playwright/test';

/**
 * Navigation entre les vues (BottomNav, visible sur mobile ≤768px).
 * Tests en viewport mobile ; serveur prod (pas d'overlay Next.js dev).
 */

test.use({ viewport: { width: 390, height: 844 } });

const VIEWS = [
  { label: 'Arbre', nav: 'Arbre' },
  { label: 'Membres', nav: 'Membres' },
  { label: 'Carte', nav: 'Carte' },
  { label: 'Journal', nav: 'Journal' },
] as const;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  const demoBtn = page.getByRole('button', { name: /Essayer la démo/i }).first();
  await Promise.all([page.waitForURL('**/app'), demoBtn.click()]);
});

for (const { label, nav } of VIEWS) {
  test(`${label} view loads without crash`, async ({ page }) => {
    const bottomNav = page.locator('nav[aria-label="Navigation mobile"]');
    await bottomNav.getByRole('button', { name: nav }).click();
    await expect(bottomNav.getByRole('button', { name: nav })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.locator('body')).not.toContainText('Application error');
  });
}

test('navigating back to Dashboard shows the greeting', async ({ page }) => {
  const bottomNav = page.locator('nav[aria-label="Navigation mobile"]');
  await bottomNav.getByRole('button', { name: 'Arbre' }).click();
  await page.locator('.tree-svg').waitFor({ state: 'visible' });
  // Ouvrir la sidebar via le bouton Menu, puis cliquer Accueil
  await bottomNav.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('button', { name: 'Accueil' }).first().click();
  await expect(page.locator('body')).toContainText('Bonjour');
});
