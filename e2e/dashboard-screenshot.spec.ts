import { test, expect } from '@playwright/test';

/**
 * Visual capture of the connected dashboard (default /app view) populated with
 * the seeded "Famille Dupont" demo tree. Not an assertion-heavy test — it drives
 * the demo flow then screenshots the dashboard for design review.
 */
test('dashboard screenshot (Famille Dupont demo)', async ({ page }) => {
  await page.goto('/');
  const demoBtn = page.getByRole('button', { name: /Essayer la démo/i }).first();
  await expect(demoBtn).toBeVisible();
  await Promise.all([page.waitForURL('**/app'), demoBtn.click()]);
  await expect(page).toHaveURL(/\/app$/);

  // Dashboard is the default view. DashboardView.tsx shows the ACTIVE TREE NAME
  // in the <h1> as soon as a tree exists (hasTree) — "Bonjour" is only the
  // fallback for zero trees, never true in demo (useFamilyStore always seeds
  // "Famille Dupont"). Same fix already applied to e2e/dashboard.spec.ts in
  // cb4c322; this screenshot spec was missed at the time.
  await expect(page.getByRole('heading', { name: 'Famille Dupont' })).toBeVisible();
  // Let the staggered fade-in settle.
  await page.waitForTimeout(900);

  await page.screenshot({ path: 'dashboard.png', fullPage: true });
});
