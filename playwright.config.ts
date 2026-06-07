import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. Tests run against a local Next dev server that Playwright boots
 * automatically (reusing an already-running one in local dev). `.env.local`
 * is picked up by Next, so Supabase env vars flow through to the proxy.
 *
 * Requires Node 22 (see repo README / nvm) and `npx playwright install chromium`.
 */
const PORT = 3000;
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    // Block the PWA service worker in tests: a stale SW cache otherwise serves
    // an outdated bundle after page.reload(), hanging the client on its loading
    // screen (the app never rehydrates). Real browsers update the SW on reload.
    serviceWorkers: 'block',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Skip the managed server when pointing at an external URL (e.g. prod smoke test).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
