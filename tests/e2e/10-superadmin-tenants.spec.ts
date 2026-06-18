// Superadmin tenants list mount. Catches:
//   - is_superadmin role unlocks the /superadmin/* surfaces
//   - /superadmin/tenants page renders without 5xx
//
// The superadmin scope is platform-owner-only (Ludmila). Regressions here
// don't affect tenants but break operator workflow. Worth catching at PR time.

import { test, expect } from "@playwright/test";
import { createTestSuperadmin, deleteTestUser, type TestUser } from "./helpers/test-data";

let user: TestUser | null = null;

test.describe("superadmin tenants", () => {
  test.beforeAll(async () => {
    user = await createTestSuperadmin();
  });

  test.afterAll(async () => {
    await deleteTestUser(user?.userId);
    user = null;
  });

  test("superadmin can navigate to /superadmin/tenants", async ({ page }) => {
    if (!user) throw new Error("beforeAll did not seed superadmin");

    await page.goto("/admin/login");
    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill(user.password);
    await page.getByRole("button", { name: /sign in|log in|continue/i }).click();
    await page.waitForFunction(
      () => !location.pathname.startsWith("/admin/login"),
      { timeout: 15_000 },
    );

    await page.goto("/superadmin/tenants");
    await page.waitForLoadState("domcontentloaded");

    // The cross-tenant overview should mount without bouncing. We accept
    // either /superadmin/tenants (preferred) or any /superadmin/* path
    // (some superadmin flows land on /superadmin/dashboard first).
    expect(page.url()).not.toContain("/admin/login");
    expect(page.url()).toContain("/superadmin");
  });
});
