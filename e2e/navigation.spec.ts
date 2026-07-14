import { test, expect } from '@playwright/test';

/**
 * Navigation entre les vues (BottomNav, visible sur mobile ≤768px).
 * Tests en viewport mobile ; serveur prod (pas d'overlay Next.js dev).
 */

test.use({ viewport: { width: 390, height: 844 } });

const VIEWS = [
  { label: 'Arbre', nav: 'Arbre' },
  // BottomNav's "list" item is labelled "Personnes" (messages/fr.json
  // nav.persons), not "Membres" — that string belongs to the sharing/members
  // panel, a different surface.
  { label: 'Personnes', nav: 'Personnes' },
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

test('navigating back to Dashboard shows the tree name', async ({ page }) => {
  const bottomNav = page.locator('nav[aria-label="Navigation mobile"]');
  await bottomNav.getByRole('button', { name: 'Arbre' }).click();
  // Focus is the default tree view (TreeView.tsx) — `.tree-svg` only mounts
  // once the user explicitly switches to "Complète"; wait on FocusTree's own
  // root instead, matching what actually renders by default.
  await page.locator('.ft-root').waitFor({ state: 'visible' });
  // Ouvrir la sidebar via le bouton Menu, puis cliquer Accueil
  await bottomNav.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('button', { name: 'Accueil' }).first().click();
  // DashboardView shows the active tree's name once a tree is loaded (never
  // a personal greeting in the demo flow — see dashboard.spec.ts's comment).
  await expect(page.locator('body')).toContainText('Famille Dupont');
});
