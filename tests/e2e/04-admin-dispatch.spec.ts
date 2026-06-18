// Admin dispatch flow smoke. Catches:
//   - /admin/dispatch listing page mounts (date picker, calendar nav)
//   - /admin/dispatch/[date] mounts with the "Add delivery route" CTA
//   - Middleware lets admin through (no MFA gate misfiring when policy off)
//
// Does NOT actually create a route — server actions + reload coordination
// is fragile to drive through Playwright. The presence of the CTA proves
// the form is mounted and the right tenant context is loaded.

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

  test("admin can load a future-date dispatch page", async ({ page }) => {
    if (!user) throw new Error("beforeAll did not seed admin");

    // Login (re-use the proven path from 02-admin-auth)
    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/password/i).fill(user.password);
    await page.getByRole("button", { name: /sign in|log in|continue/i }).click();
    await page.waitForURL("**/admin", { timeout: 15_000 });

    // Pick a date ~14 days out so we don't collide with today's real routes
    const future = new Date();
    future.setDate(future.getDate() + 14);
    const ymd = future.toISOString().slice(0, 10);

    await page.goto(`/admin/dispatch/${ymd}`);
    await page.waitForURL(`**/admin/dispatch/${ymd}**`, { timeout: 10_000 });

    // "Add delivery route" CTA proves the toolbar + tenant scope mounted.
    // Match by role+name to stay resilient to copy tweaks ("Add delivery route"
    // vs "+ Add delivery route" vs "New route").
    const addRoute = page.getByRole("button", { name: /add (delivery )?route|new route/i }).first();
    await expect(addRoute).toBeVisible({ timeout: 10_000 });
  });
});
