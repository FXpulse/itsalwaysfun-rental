// Admin login → dashboard. Catches:
//   - Auth provider misconfig (Supabase env vars wrong)
//   - Middleware redirect loops (the common scary regression)
//   - Dashboard page render errors (some query throws → red screen)
//
// Uses a throwaway admin user created in beforeAll, deleted in afterAll.

import { test, expect } from "@playwright/test";
import { createTestAdmin, deleteTestUser, type TestUser } from "./helpers/test-data";

let user: TestUser | null = null;

test.describe("admin auth", () => {
  test.beforeAll(async () => {
    user = await createTestAdmin();
  });

  test.afterAll(async () => {
    await deleteTestUser(user?.userId);
    user = null;
  });

  test("login flow lands on /admin without errors", async ({ page }) => {
    if (!user) throw new Error("beforeAll did not seed test user");

    await page.goto("/admin/login");

    // Login form has email + password inputs. Pinning by label/role keeps
    // the test stable as the design evolves.
    // Prefer input[type] over label match — more robust against label/copy tweaks.
    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill(user.password);

    // The CTA copy varies ("Sign in" / "Log in"). Match by role+name regex.
    const submit = page.getByRole("button", { name: /sign in|log in|continue/i });
    await submit.click();

    // After login the middleware can land the user on any admin route
    // depending on tenant state (/admin, /admin/dashboard, /admin/settings/...
    // for MFA gating, /admin/setup-stripe, etc). Wait for any URL under /admin
    // that's NOT /admin/login — that proves the auth flow succeeded.
    await page.waitForFunction(
      () => {
        const p = location.pathname;
        return p.startsWith("/admin") && !p.startsWith("/admin/login");
      },
      { timeout: 15_000 },
    );

    // Sanity-check we're not still in the login URL.
    expect(page.url()).not.toContain("/admin/login");
    expect(page.url()).toContain("/admin");
    // Sidebar / topbar are always present — match a stable element. The
    // word "Bookings" appears in the main nav of /admin.
    await expect(page.getByText(/bookings/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
