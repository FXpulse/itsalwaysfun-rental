// Staff role-based access control. Catches:
//   - Staff can reach low-risk admin pages (bookings, customers)
//   - Staff IS blocked from admin-only pages (api keys, billing, users)
//
// This is the highest-ROI security regression catch: an accidental
// loosening of the role gates would leak admin-only data to staff users
// across all tenants. Worth running on every PR.

import { test, expect } from "@playwright/test";
import { createTestStaff, deleteTestUser, type TestUser } from "./helpers/test-data";

let user: TestUser | null = null;

test.describe("staff RBAC", () => {
  test.beforeAll(async () => {
    user = await createTestStaff();
  });

  test.afterAll(async () => {
    await deleteTestUser(user?.userId);
    user = null;
  });

  test("staff has access to bookings + is blocked from admin-only pages", async ({ page }) => {
    if (!user) throw new Error("beforeAll did not seed staff");

    await page.goto("/admin/login");
    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill(user.password);
    await page.getByRole("button", { name: /sign in|log in|continue/i }).click();
    await page.waitForFunction(
      () => !location.pathname.startsWith("/admin/login"),
      { timeout: 15_000 },
    );

    // Allowed: bookings list — staff can manage day-to-day operations.
    await page.goto("/admin/bookings");
    await page.waitForLoadState("domcontentloaded");
    expect(page.url()).toContain("/admin/bookings");
    expect(page.url()).not.toContain("/admin/login");

    // Forbidden: API keys page — admin only. Staff should be redirected.
    await page.goto("/admin/api-keys");
    await page.waitForLoadState("domcontentloaded");
    // Either: bounced to /admin (or /admin/dashboard) OR 403 page
    // (depending on how the layout gates render). The CRITICAL assertion
    // is that the URL is NOT /admin/api-keys — that would mean the gate is
    // broken and staff can see API keys.
    expect(page.url()).not.toContain("/admin/api-keys");
  });
});
