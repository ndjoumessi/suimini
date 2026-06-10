import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. Tests run against a local Next dev server that Playwright boots
 * automatically (reusing an already-running one in local dev). `.env.local`
 * is picked up by Next, so Supabase env vars flow through to the proxy.
 *
 * Requires Node 22 (see repo README / nvm) and `npx playwright install chromium`.
 */
// Tests always run against a production build (no Next.js dev overlay).
// Port 3001 avoids conflicts with a running dev server on 3000.
// CI overrides via E2E_BASE_URL (already on a prod next start).
const TEST_PORT = 3001;
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${TEST_PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    // Block the PWA service worker in tests: a stale SW cache otherwise serves
    // an outdated bundle after page.reload(), hanging the client on its loading
    // screen (the app never rehydrates). Real browsers update the SW on reload.
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Skip the managed server when pointing at an external URL (e.g. prod smoke test).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Production build removes the Next.js dev overlay that intercepts pointer
        // events and blocks BottomNav clicks in dev mode.
        command: `npm run build && npx next start -p ${TEST_PORT}`,
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 180_000,
      },
});
