import { test, expect } from '@playwright/test';

/**
 * Reproduction: editing a person via the front form must persist across reload.
 * Runs in DEMO mode (localStorage/IndexedDB) so it exercises the SHARED mutation
 * path updatePerson → commit → persist → reload-rehydrate, with no login needed.
 */
test('editing a person first name persists across reload (demo)', async ({ page }) => {
  await page.goto('/');
  await Promise.all([
    page.waitForURL('**/app'),
    page.getByRole('button', { name: /Essayer la démo/i }).first().click(),
  ]);
  await expect(page).toHaveURL(/\/app$/);

  // Open a person. Try tree node, fall back to any clickable "Henri".
  const henri = page.getByText(/Henri/).first();
  await henri.click();

  const panel = page.getByTestId('person-panel');
  await expect(panel).toBeVisible();

  // Enter edit mode.
  await panel.getByRole('button', { name: 'Modifier' }).first().click();

  // Change the first name.
  const firstName = panel.getByRole('textbox', { name: /Prénom/ });
  await expect(firstName).toBeVisible();
  const NEW = 'HenriEdit42';
  await firstName.fill(NEW);

  // Save.
  await panel.getByRole('button', { name: 'Enregistrer' }).click();

  // Give the debounced local persist + any cloud push time to flush.
  await page.waitForTimeout(1200);

  // Verify it's in localStorage before reload.
  const before = await page.evaluate((n) => JSON.stringify(JSON.parse(localStorage.getItem('suimini_trees') || '[]')).includes(n), NEW);
  expect(before, 'edit should be in localStorage before reload').toBe(true);

  await page.reload();
  await expect(page).toHaveURL(/\/app$/);

  // The edited name must survive.
  await expect(page.getByText(NEW).first()).toBeVisible({ timeout: 10000 });
});
