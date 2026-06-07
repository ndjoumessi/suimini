import { test, expect } from '@playwright/test';

/**
 * Demo flow: a visitor enters the app without an account.
 *
 * Clicking "Essayer sans compte" must:
 *   1. mark demo mode (localStorage `suimini_demo` + cookie for the proxy),
 *   2. seed the sample tree, and
 *   3. land on /app — past BOTH the server proxy gate and the client guard —
 *      and survive a reload.
 *
 * Cookie + localStorage are checked because the two guards read different
 * sources: the proxy reads the cookie, the client guard reads localStorage.
 */
test.describe('demo flow', () => {
  test('start demo from the landing → /app, persisted across reload', async ({ page, context }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Suimini/);

    const demoBtn = page.getByRole('button', { name: /Essayer la démo/i }).first();
    await expect(demoBtn).toBeVisible();

    await Promise.all([page.waitForURL('**/app'), demoBtn.click()]);

    // Past the client guard (it would bounce back to / otherwise).
    await expect(page).toHaveURL(/\/app$/);
    await expect(page).toHaveTitle(/Arbre Généalogique/);

    // Demo banner confirms the app rendered in demo mode.
    await expect(page.locator('.demo-banner-text')).toBeVisible();

    // localStorage: demo flag + seeded sample tree.
    const ls = await page.evaluate(() => ({
      demo: localStorage.getItem('suimini_demo'),
      hasTrees: !!localStorage.getItem('suimini_trees'),
      active: localStorage.getItem('suimini_active_tree'),
    }));
    expect(ls.demo).toBe('true');
    expect(ls.hasTrees).toBe(true);
    expect(ls.active).toBeTruthy();

    // Cookie the proxy relies on, server-side.
    const cookie = (await context.cookies()).find((c) => c.name === 'suimini_demo');
    expect(cookie?.value).toBe('true');

    // Reload keeps the demo session (no bounce to landing).
    await page.reload();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.locator('.demo-banner-text')).toBeVisible();
  });

  test('exiting the demo returns to the landing and clears the flag', async ({ page, context }) => {
    await page.goto('/');
    await Promise.all([
      page.waitForURL('**/app'),
      page.getByRole('button', { name: /Essayer la démo/i }).first().click(),
    ]);

    await page.getByRole('button', { name: /Quitter la démo/i }).click();
    await page.waitForURL((url) => url.pathname === '/');

    const demo = await page.evaluate(() => localStorage.getItem('suimini_demo'));
    expect(demo).toBeNull();
    const cookie = (await context.cookies()).find((c) => c.name === 'suimini_demo');
    // Cookie is either removed or explicitly set to a non-"true" value.
    expect(cookie?.value).not.toBe('true');
  });
});
