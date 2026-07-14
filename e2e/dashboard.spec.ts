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

// No "shows a greeting" test here: DashboardView's <h1> shows the active
// tree's name whenever a tree is loaded (`hasTree` — see DashboardView.tsx),
// and the demo flow always seeds one. The `t('greeting'…)`/`greetingGeneric`
// copy only renders with zero trees, a state this flow never reaches — it
// would be dead code in this test. "dashboard shows the demo tree name"
// below already covers what actually renders here.

test('dashboard stats include the 19 demo persons', async ({ page }) => {
  // sampleData.ts seeds ids p1..p19 — kept in sync if that dataset grows again.
  await expect(page.locator('body')).toContainText('19');
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
