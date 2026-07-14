import { test, expect } from '@playwright/test';

/**
 * Screenshot capture of 3 features for design review:
 *  - auth button in loading/spinner state
 *  - mobile TreeView (390px) with bottom nav
 *  - /confidentialite and /cgu legal pages
 *
 * Not assertion-heavy by design (the point is the screenshots, not a pass/fail
 * signal), but every step waits on a real `expect(...).toBeVisible()` rather
 * than a blind `waitForTimeout` + swallowed `.catch()` — a genuinely broken
 * selector now fails the test instead of silently screenshotting whatever
 * happened to be on screen. That's what let this run safely in CI (see
 * .github/workflows/ci.yml) instead of being permanently local-only.
 */

test('shot: auth modal with loading spinner', async ({ page }) => {
  await page.goto('/');
  const signInBtn = page.getByRole('button', { name: 'Se connecter' }).first();
  await expect(signInBtn).toBeVisible();
  await signInBtn.click();

  const email = page.locator('input[type="email"]').first();
  await expect(email).toBeVisible();
  await email.fill('demo@example.com');
  const pw = page.locator('input[type="password"]').first();
  await expect(pw).toBeVisible();
  await pw.fill('password123');

  // Slow the auth network call so the spinner is visible when we screenshot.
  await page.route('**/auth/v1/**', async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  const submit = page.getByRole('button', { name: /Se connecter|Connexion/i }).last();
  await submit.click();
  await page.waitForTimeout(500); // let the spinner actually render before the shot
  await page.screenshot({ path: 'shot-auth-loading.png' });
});

test('shot: mobile TreeView 390px with bottom nav', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const demoBtn = page.getByRole('button', { name: /Essayer la démo/i }).first();
  await expect(demoBtn).toBeVisible();
  await Promise.all([page.waitForURL('**/app'), demoBtn.click()]);
  await expect(page.getByRole('heading', { name: /Bonjour/i })).toBeVisible({ timeout: 15_000 });

  // Switch to the tree view via the bottom nav (TreePine / "Arbre").
  const treeNav = page.getByRole('button', { name: /^Arbre$/i }).last();
  await expect(treeNav).toBeVisible();
  await treeNav.click();
  await page.waitForTimeout(1500); // let the tree layout/animation settle
  await page.screenshot({ path: 'shot-mobile-tree.png' });
});

test('shot: confidentialite', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1400 });
  await page.goto('/confidentialite');
  await expect(page.locator('main')).toBeVisible();
  await page.screenshot({ path: 'shot-confidentialite.png', fullPage: true });
});

test('shot: cgu', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1400 });
  await page.goto('/cgu');
  await expect(page.locator('main')).toBeVisible();
  await page.screenshot({ path: 'shot-cgu.png', fullPage: true });
});
