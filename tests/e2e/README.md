# E2E tests (Playwright)

Browser-driven tests that cover the most regression-prone UI flows. Run on
top of `npm run dev` against a real Supabase test project + real Stripe test
key. Slower than the vitest layers but catches what they cannot (CSS broken,
form state lost between steps, middleware redirect loops, etc.).

## Quick start (local)

```bash
# In one terminal:
npm run dev

# In another:
npm run e2e             # all tests, headless
npm run e2e -- --ui     # UI mode (great for debugging selectors)
npm run e2e -- --headed # see the browser
```

The first time you run, Playwright will offer to install Chromium. Already
installed if you ran the setup script.

## What lives here

| File | Covers |
|---|---|
| `01-public-smoke.spec.ts` | Apex page renders + book CTA navigates + 404 handling |
| `02-admin-auth.spec.ts` | Throwaway admin → login → dashboard mounts |
| `03-booking-wizard.spec.ts` | Date pick + advance + contact step + state preserved |

## Adding a new test

1. Create `tests/e2e/NN-name.spec.ts` (prefix with a 2-digit number for ordering).
2. Use the helpers in `helpers/test-data.ts` for setup/teardown — they create
   isolated users so concurrent runs never collide.
3. Prefer `page.getByRole()` and `page.getByLabel()` over `page.locator(".class")`
   — copy changes much less often than CSS class names.
4. NEVER hard-code production data (real customer emails, real product IDs).
   Use the helper functions to discover real-but-test data dynamically.

## Why no Stripe checkout test

Driving the Stripe-hosted checkout page through Playwright is flaky — Stripe
ships UI changes weekly that break selectors. The booking → paid → confirmation
flow is covered by the integration tests in `tests/integration/`, which fake
the webhook directly and assert DB state. The combination gives full coverage
without the flakiness.

## CI

`.github/workflows/e2e.yml` runs the full suite on every PR + push to main.
Tests run against the same `rentalflow-tests` Supabase project used by the
integration tests, plus a Stripe test secret key stored as a repo secret.

## Debugging a flaky test

```bash
npm run e2e -- --headed --debug   # step through, inspect DOM
npm run e2e -- --trace on         # generate full trace, view with `npx playwright show-trace`
```
