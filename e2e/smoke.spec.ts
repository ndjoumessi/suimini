import { test, expect } from '@playwright/test';

/**
 * Smoke tests — the critical public surface must load and the core funnels work.
 * Kept resilient (role/regex selectors) so copy tweaks don't break CI.
 */

test('landing page loads (200) with the brand title', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle(/Suimini/);
});

test('primary "Commencer" CTA is visible on the landing', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Commencer/i }).first()).toBeVisible();
});

test('demo mode works (Famille Dupont sample tree)', async ({ page }) => {
  await page.goto('/');
  const demoBtn = page.getByRole('button', { name: /Essayer la démo/i }).first();
  await expect(demoBtn).toBeVisible();
  await Promise.all([page.waitForURL('**/app'), demoBtn.click()]);
  await expect(page).toHaveURL(/\/app$/);
  // The seeded demo tree is the Dupont family — its name surfaces in the sidebar.
  await expect(page.getByText('Famille Dupont').first()).toBeVisible();
});

test('/app without a session redirects to the landing', async ({ page }) => {
  await page.goto('/app');
  await page.waitForURL((url) => url.pathname === '/', { timeout: 10_000 });
  expect(new URL(page.url()).pathname).toBe('/');
});

test('/confidentialite loads (200)', async ({ page }) => {
  const res = await page.goto('/confidentialite');
  expect(res?.status()).toBe(200);
});

test('/cgu loads (200)', async ({ page }) => {
  const res = await page.goto('/cgu');
  expect(res?.status()).toBe(200);
});

test('/sitemap.xml loads (200)', async ({ page }) => {
  const res = await page.goto('/sitemap.xml');
  expect(res?.status()).toBe(200);
  expect(res?.headers()['content-type'] || '').toContain('xml');
});

test('/invite/[token] page renders (invalid token shows error, not crash)', async ({ page }) => {
  const res = await page.goto('/invite/smoke-test-token');
  // La page doit rendre (200) même si le token est invalide.
  expect(res?.status()).toBe(200);
});

test('/profil without session redirects to landing', async ({ page }) => {
  await page.goto('/profil');
  // /profil est protégé ; sans session → redirection vers /
  await page.waitForURL((url) => url.pathname === '/', { timeout: 10_000 });
  expect(new URL(page.url()).pathname).toBe('/');
});

test('/arbre/[slug] with unknown slug shows a 404 or empty state', async ({ page }) => {
  const res = await page.goto('/arbre/smoke-test-slug-unknown');
  // Acceptable : 200 avec page "non trouvé" OU 404 natif Next.js.
  expect([200, 404]).toContain(res?.status());
});
