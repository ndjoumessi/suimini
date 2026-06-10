// Generates PWA screenshots declared in public/manifest.json.
// Requires a running Next.js server (npm run dev or next start) on BASE_URL.
//   E2E_BASE_URL=http://localhost:3000 node scripts/generate-screenshots.mjs
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

const browser = await chromium.launch();
const context = await browser.newContext();

// Desktop screenshot — /app in demo mode, tree view.
{
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(BASE_URL + '/');
  const demoBtn = page.getByRole('button', { name: /Essayer la démo/i }).first();
  await Promise.all([page.waitForURL('**/app'), demoBtn.click()]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${PUBLIC}/screenshot-desktop.png`, type: 'png' });
  await page.close();
  console.log('✓ screenshot-desktop.png  (1280×720)');
}

// Mobile screenshot — tree view on 390×844.
{
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE_URL + '/');
  const demoBtn = page.getByRole('button', { name: /Essayer la démo/i }).first();
  await Promise.all([page.waitForURL('**/app'), demoBtn.click()]);
  // Navigate to tree via BottomNav
  await page.locator('nav[aria-label="Navigation mobile"]').getByRole('button', { name: 'Arbre' }).click();
  await page.locator('.tree-svg').waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${PUBLIC}/screenshot-mobile.png`, type: 'png' });
  await page.close();
  console.log('✓ screenshot-mobile.png  (390×844)');
}

await browser.close();
console.log('\nDone — screenshots written to public/');
