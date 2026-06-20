import { test, expect } from '@playwright/test';

/**
 * Capture screenshots of the 3 features for design review:
 *  - auth button in loading/spinner state
 *  - mobile TreeView (390px) with bottom nav
 *  - /confidentialite and /cgu legal pages
 * Run against an already-running server via E2E_BASE_URL.
 */

test('shot: auth modal with loading spinner', async ({ page }) => {
  await page.goto('/');
  // Open the auth modal — the landing has a sign-in entry point.
  const signInBtn = page.getByRole('button', { name: /Se connecter|Connexion|Connecter/i }).first();
  await signInBtn.click().catch(() => {});
  await page.waitForTimeout(400);
  // Fill credentials so the submit button is enabled.
  const email = page.locator('input[type="email"]').first();
  if (await email.count()) {
    await email.fill('demo@example.com');
    const pw = page.locator('input[type="password"]').first();
    if (await pw.count()) await pw.fill('password123');
    // Slow the auth network call so the spinner is visible when we screenshot.
    await page.route('**/auth/v1/**', async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
    const submit = page.getByRole('button', { name: /Se connecter|Connexion/i }).last();
    await submit.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: 'shot-auth-loading.png' });
});

test('shot: mobile TreeView 390px with bottom nav', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const demoBtn = page.getByRole('button', { name: /Essayer la démo|Essayer sans compte/i }).first();
  await Promise.all([page.waitForURL('**/app'), demoBtn.click()]);
  await page.getByRole('heading', { name: /Bonjour/i }).waitFor({ timeout: 15000 }).catch(() => {});
  // Switch to the tree view via the bottom nav (TreePine / "Arbre").
  try {
    const treeNav = page.getByRole('button', { name: /^Arbre$/i }).last();
    await treeNav.click({ timeout: 5000 });
    await page.waitForTimeout(1500);
  } catch {
    /* fall through — capture whatever is on screen */
  }
  await page.screenshot({ path: 'shot-mobile-tree.png' });
});

test('shot: confidentialite', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1400 });
  await page.goto('/confidentialite');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'shot-confidentialite.png', fullPage: true });
});

test('shot: cgu', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1400 });
  await page.goto('/cgu');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'shot-cgu.png', fullPage: true });
});
