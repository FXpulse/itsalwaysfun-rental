// Driver auth + mobile shell smoke. Catches:
//   - role='driver' user can log in via /admin/login (shared)
//   - Middleware redirects them to /driver (not /admin)
//   - The driver mobile shell mounts with the BottomNav (Routes/Inbox/Me)
//
// Does NOT cover driver actually marking stops delivered — that needs
// seeded routes + stops with specific timing, which adds flake. The auth
// gate + shell mount is the highest-ROI signal.

import { test, expect } from "@playwright/test";
import { createTestDriver, deleteTestUser, type TestUser } from "./helpers/test-data";

let user: TestUser | null = null;

test.describe("driver auth", () => {
  test.beforeAll(async () => {
    user = await createTestDriver();
  });

  test.afterAll(async () => {
    await deleteTestUser(user?.userId);
    user = null;
  });

  test("driver login lands on /driver with mobile nav", async ({ page }) => {
    if (!user) throw new Error("beforeAll did not seed driver");

    // /driver requires auth — without it middleware redirects to login
    await page.goto("/driver");
    await page.waitForURL("**/admin/login**", { timeout: 10_000 });

    // Now login with the driver creds we just seeded
    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill(user.password);
    await page.getByRole("button", { name: /sign in|log in|continue/i }).click();

    // After login, middleware sends driver-role users to /driver (not /admin).
    // The "next=/driver" query param from the initial redirect helps too.
    await page.waitForURL("**/driver**", { timeout: 15_000 });
    expect(page.url()).toContain("/driver");

    // BottomNav is part of the driver shell. It has 3 tabs: Routes, Inbox, Me.
    // Pin to "Routes" link — least likely to be renamed.
    await expect(page.getByRole("link", { name: /routes/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
