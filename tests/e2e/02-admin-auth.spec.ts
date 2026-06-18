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

    // After login: middleware should land the user on /admin (the dashboard).
    // If MFA is required this would redirect to /admin/mfa-verify — for our
    // throwaway user MFA is off by default.
    await page.waitForURL("**/admin", { timeout: 15_000 });

    // Dashboard should render *something* with admin in the URL — we don't
    // pin specific copy because the dashboard layout changes often. We just
    // want to see no 5xx and that the layout mounted.
    expect(page.url()).toContain("/admin");
    // Sidebar / topbar are always present — match a stable element. The
    // word "Bookings" appears in the main nav of /admin.
    await expect(page.getByText(/bookings/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
