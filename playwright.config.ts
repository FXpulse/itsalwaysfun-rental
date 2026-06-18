// Playwright config for the E2E test suite.
//
// What this covers vs the other test layers:
//   - unit (vitest): pure functions, schemas, mappers in lib/.
//   - integration (vitest): server actions hit a real Supabase test project.
//   - e2e (playwright, this file): full browser drives the UI through real
//     pages, real server actions, real DB. The slowest + most authentic layer.
//
// Browsers: Chromium only — Firefox + WebKit add 3-4 min to runs without
// catching meaningful bugs for our stack. Re-enable if a customer reports a
// browser-specific issue.
//
// Server: tests assume `npm run dev` is already running on PLAYWRIGHT_BASE_URL
// (default http://localhost:3000) OR that BASE_URL points at a deployed
// preview. CI uses `webServer` block to auto-start dev locally.

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["github"], ["list"]] : "list",
  timeout: 60_000,
  expect: { timeout: 8_000 },

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // CI: spin up the dev server (or use a preview URL via baseURL env).
  // Local: assume the dev runs in another terminal.
  webServer: isCI
    ? {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          // Tell the app to use the test Supabase project + a test Stripe key.
          NEXT_PUBLIC_SUPABASE_URL: process.env.TEST_SUPABASE_URL || "",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.TEST_SUPABASE_ANON_KEY || "",
          SUPABASE_SERVICE_ROLE_KEY: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || "",
          STRIPE_SECRET_KEY: process.env.TEST_STRIPE_SECRET_KEY || "",
          STRIPE_WEBHOOK_SECRET: process.env.TEST_STRIPE_WEBHOOK_SECRET || "",
          E2E_MODE: "1",
        },
      }
    : undefined,
});
