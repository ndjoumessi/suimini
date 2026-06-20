import { test } from '@playwright/test';

/**
 * Local-only screenshot capture for the PDF-booklet + owner-notification features.
 * Skipped in CI (popup/window.open + demo flow are flaky there).
 * Run against an already-running server via E2E_BASE_URL.
 */
test.skip(!!process.env.CI, 'Local-only screenshot capture (flaky under CI)');

test('shot: export PDF modal + generated booklet', async ({ page, context }) => {
  // Neutralise window.print() so the popup never blocks on a print dialog.
  await context.addInitScript(() => { window.print = () => {}; });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const demoBtn = page.getByRole('button', { name: /Essayer la démo|Essayer sans compte/i }).first();
  await Promise.all([page.waitForURL('**/app'), demoBtn.click()]);
  await page.getByRole('heading', { name: /Bonjour/i }).waitFor({ timeout: 15000 }).catch(() => {});

  // Open the export modal via the sidebar "Exporter le livret" button.
  const exportBtn = page.getByRole('button', { name: /Exporter le livret/i }).first();
  await exportBtn.click({ timeout: 8000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'shot-pdf-modal.png' });

  // Generate → the booklet HTML opens in a popup window.
  const popupPromise = context.waitForEvent('page', { timeout: 10000 }).catch(() => null);
  const genBtn = page.getByRole('button', { name: /Générer le PDF/i }).first();
  await genBtn.click();
  const popup = await popupPromise;
  if (popup) {
    await popup.waitForLoadState('domcontentloaded').catch(() => {});
    await popup.waitForTimeout(1500); // let Google Fonts + layout settle
    await popup.screenshot({ path: 'shot-pdf-booklet.png', fullPage: true });
  }
});

test('shot: owner notification email', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 900 });
  await page.goto('file:///tmp/member-joined-email.html');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'shot-email-notification.png', fullPage: true });
});
