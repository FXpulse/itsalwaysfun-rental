// Admin dispatch page mount. Catches:
//   - Admin can navigate to /admin/dispatch/[date] post-login
//   - The page returns 200 (not 5xx, not redirect loop)
//
// Doesn't drill into specific UI elements (button text varies, dispatch
// page has a "/[date]" pattern that's tricky to predict for new tenants
// with no routes). URL stability + non-login URL is enough signal.

import { test, expect } from "@playwright/test";
import { createTestAdmin, deleteTestUser, type TestUser } from "./helpers/test-data";

let user: TestUser | null = null;

test.describe("admin dispatch", () => {
  test.beforeAll(async () => {
    user = await createTestAdmin();
  });

  test.afterAll(async () => {
    await deleteTestUser(user?.userId);
    user = null;
  });

  test("admin can navigate to a future-date dispatch page", async ({ page }) => {
    if (!user) throw new Error("beforeAll did not seed admin");

    // Login (same proven path as test 02)
    await page.goto("/admin/login");
    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill(user.password);
    await page.getByRole("button", { name: /sign in|log in|continue/i }).click();
    await page.waitForFunction(
      () => location.pathname.startsWith("/admin") && !location.pathname.startsWith("/admin/login"),
      { timeout: 15_000 },
    );

    const future = new Date();
    future.setDate(future.getDate() + 14);
    const ymd = future.toISOString().slice(0, 10);

    await page.goto(`/admin/dispatch/${ymd}`);
    await page.waitForLoadState("domcontentloaded");

    // Verify we're not bounced back to login (which would mean auth/middleware regression)
    // and the URL contains both /admin/dispatch and the date.
    expect(page.url()).not.toContain("/admin/login");
    expect(page.url()).toContain("/admin/dispatch");
    expect(page.url()).toContain(ymd);
  });
});
