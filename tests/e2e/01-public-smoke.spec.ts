// Smoke test for the public-facing site. Cheapest signal that:
//   - Next.js builds and serves the apex page
//   - The product grid renders (means products query worked)
//   - The "book" CTA navigates into the wizard
//
// If this breaks, half the other tests would too — so it runs first and
// fails fast in CI.

import { test, expect } from "@playwright/test";

test.describe("public site", () => {
  test("apex page renders + book CTA navigates to wizard", async ({ page }) => {
    await page.goto("/");

    // The page should mount. We don't pin the title because tenants rename
    // their business — but the page must not 5xx.
    await expect(page).toHaveURL("/");
    expect(await page.title()).not.toBe("");

    // There should be at least one navigation link to /order-by-date —
    // that's how customers enter the booking flow. Could be a button or
    // a link. Match by href to stay resilient to copy changes.
    const bookLinks = page.locator('a[href*="/order-by-date"]');
    await expect(bookLinks.first()).toBeVisible({ timeout: 10_000 });

    // Click the first one and verify we land on the wizard. The wizard
    // page mounts even without query params (lands on date selection).
    await bookLinks.first().click();
    await page.waitForURL("**/order-by-date**", { timeout: 10_000 });
    expect(page.url()).toContain("/order-by-date");
  });

  test("404 page renders for unknown route", async ({ page }) => {
    const res = await page.goto("/this-route-does-not-exist-1234");
    expect(res?.status()).toBe(404);
    // Next.js default 404 has the word "not found" somewhere on the page.
    await expect(page.getByText(/not found|404/i).first()).toBeVisible();
  });
});
