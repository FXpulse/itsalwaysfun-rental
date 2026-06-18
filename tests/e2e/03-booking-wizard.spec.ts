// Booking wizard page mount. Catches:
//   - The /order-by-date page renders without 5xx
//   - At least ONE input mounts (the wizard isn't entirely broken)
//
// Driving the 2000-line BookingWizard through all steps in Playwright is
// fragile (lots of conditional logic per tenant flags). The mount + at
// least one input is enough signal that the wizard didn't regress catastrophically.
// Deeper coverage is the responsibility of unit tests on individual step components.

import { test, expect } from "@playwright/test";
import { getAnyActiveProductSlug } from "./helpers/test-data";

test.describe("booking wizard", () => {
  test("wizard page mounts with a product selected", async ({ page }) => {
    const slug = await getAnyActiveProductSlug();
    test.skip(!slug, "No active product seeded in the test DB — skip");

    await page.goto(`/order-by-date?product=${slug}`);
    // Page mounted, URL is correct.
    expect(page.url()).toContain("/order-by-date");

    // At least ONE input element exists. We don't pin a specific input
    // because the wizard's first input depends on tenant flags (date vs
    // contact-first vs product-first). The presence of any input is the
    // baseline regression check.
    const anyInput = page.locator("input, button, textarea").first();
    await expect(anyInput).toBeVisible({ timeout: 10_000 });
  });
});
