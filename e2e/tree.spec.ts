import { test, expect, type Page } from '@playwright/test';

/**
 * Arbre généalogique — noeuds, PersonPanel, zoom, mode sombre.
 *
 * Viewport mobile (390px) : BottomNav visible (≤768px).
 * Les tests tournent contre le build prod (playwright.config.ts) :
 * pas d'overlay Next.js dev → les clics BottomNav fonctionnent normalement.
 */

test.use({ viewport: { width: 390, height: 844 } });

const enterDemoAndOpenTree = async (page: Page) => {
  await page.goto('/');
  const demoBtn = page.getByRole('button', { name: /Essayer la démo/i }).first();
  await Promise.all([page.waitForURL('**/app'), demoBtn.click()]);
  await page
    .locator('nav[aria-label="Navigation mobile"]')
    .getByRole('button', { name: 'Arbre' })
    .click();
  await page.locator('.tree-svg').waitFor({ state: 'visible' });
};

test.beforeEach(async ({ page }) => {
  await enterDemoAndOpenTree(page);
});

test('tree renders sample nodes', async ({ page }) => {
  // Le layout vertical affiche 11 des 13 personnes selon generationsToShow par défaut.
  await expect(page.locator('.person-node')).toHaveCount(11);
});

test('clicking a node opens PersonPanel', async ({ page }) => {
  await page.locator('.person-node').first().click();
  await expect(page.locator('[data-testid="person-panel"]')).toBeVisible();
});

test('PersonPanel closes on the Fermer button', async ({ page }) => {
  await page.locator('.person-node').first().click();
  await expect(page.locator('[data-testid="person-panel"]')).toBeVisible();
  await page.getByRole('button', { name: 'Fermer le panneau' }).click();
  await expect(page.locator('[data-testid="person-panel"]')).not.toBeVisible();
});

test('zoom in increases the displayed percentage', async ({ page }) => {
  // Échelle initiale 1.1 → 110% ; zoom avant ×1.2 → 132%
  await page.getByRole('button', { name: 'Zoom avant' }).click();
  await expect(page.getByText('132%')).toBeVisible();
});

test('zoom reset returns to 100%', async ({ page }) => {
  await page.getByRole('button', { name: 'Zoom avant' }).click();
  await page.getByRole('button', { name: 'Réinitialiser le zoom' }).click();
  await expect(page.getByText('100%')).toBeVisible();
});

test('dark mode toggle sets data-theme="dark"', async ({ page }) => {
  // Ouvrir la sidebar via le bouton Menu du BottomNav
  await page
    .locator('nav[aria-label="Navigation mobile"]')
    .getByRole('button', { name: 'Ouvrir le menu' })
    .click();
  await page.getByRole('button', { name: 'Activer le mode sombre' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
