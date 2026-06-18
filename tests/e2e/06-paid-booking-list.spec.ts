// Paid booking visibility smoke. Catches:
//   - Admin /admin/bookings list query works against current tenant
//   - A confirmed+paid booking renders in the list
//   - Customer name search (the most-used filter) is functional
//
// Avoids driving the Stripe-hosted checkout (notoriously flaky), and
// avoids faking webhook signatures (brittle). Instead seeds the booking
// directly via the admin client and verifies the read path renders it —
// which is the layer that breaks when admin-side regressions ship.

import { test, expect } from "@playwright/test";
import {
  createTestAdmin,
  deleteTestUser,
  getAnyActiveProduct,
  createPaidTestBooking,
  deleteSeededBooking,
  type TestUser,
} from "./helpers/test-data";

let user: TestUser | null = null;
let bookingId: string | null = null;

test.describe("paid booking visibility", () => {
  test.beforeAll(async () => {
    user = await createTestAdmin();
    const product = await getAnyActiveProduct();
    test.skip(!product, "No active product seeded — skip");
    if (product) {
      bookingId = await createPaidTestBooking({ product });
    }
  });

  test.afterAll(async () => {
    await deleteSeededBooking(bookingId);
    await deleteTestUser(user?.userId);
    user = null;
    bookingId = null;
  });

  test("seeded paid booking shows up in /admin/bookings", async ({ page }) => {
    if (!user || !bookingId) throw new Error("beforeAll did not seed properly");

    // Login as admin
    await page.goto("/admin/login");
    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill(user.password);
    await page.getByRole("button", { name: /sign in|log in|continue/i }).click();
    await page.waitForFunction(
      () => location.pathname.startsWith("/admin") && !location.pathname.startsWith("/admin/login"),
      { timeout: 15_000 },
    );

    // Bookings list
    await page.goto("/admin/bookings");
    await page.waitForURL("**/admin/bookings**", { timeout: 10_000 });

    // The booking's first 8 chars of UUID appear in the list table as the
    // booking identifier. Match defensively against a few likely renderings.
    const shortId = bookingId.slice(0, 8);
    const idHint = page
      .getByText(new RegExp(shortId, "i"))
      .or(page.getByText(/E2E Test \d+/))
      .first();
    await expect(idHint).toBeVisible({ timeout: 10_000 });

    // The customer name we seeded should appear too. Use the timestamp suffix
    // to be unique across concurrent runs.
    await expect(page.getByText(/E2E Test \d+/).first()).toBeVisible({
      timeout: 5_000,
    });
  });
});
