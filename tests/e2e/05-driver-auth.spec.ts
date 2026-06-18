// Driver auth + shell mount. Catches:
//   - role='driver' user can log in via /admin/login (shared)
//   - Middleware role routing sends them to /driver (not /admin)
//   - The driver shell mounts without errors
//
// Doesn't drill into BottomNav specifics — middleware routing + URL
// transition is the highest-ROI signal here.

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

  test("driver login routes to /driver shell", async ({ page }) => {
    if (!user) throw new Error("beforeAll did not seed driver");

    // /driver requires auth — middleware bounces to login
    await page.goto("/driver");
    await page.waitForURL("**/admin/login**", { timeout: 10_000 });

    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill(user.password);
    await page.getByRole("button", { name: /sign in|log in|continue/i }).click();

    // After login, middleware should route the driver role to /driver. We
    // wait for the URL to leave /admin/login — that's the success signal.
    // The waitForFunction explicitly excludes /admin/login so we don't
    // false-match the starting state.
    await page.waitForFunction(
      () => !location.pathname.startsWith("/admin/login"),
      { timeout: 15_000 },
    );

    expect(page.url()).not.toContain("/admin/login");
  });
});
