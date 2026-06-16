# Integration tests

Tests in this folder exercise multi-component flows end-to-end against a real
Postgres database. Unlike `tests/unit/*` (pure functions), these tests hit the
DB layer + server actions + sometimes simulate webhooks.

## When to write integration tests

- **Booking flow happy path** (check-and-hold → payment → confirmation email)
- **Webhook handlers** (Stripe payment_intent.succeeded, charge.refunded, GHL events)
- **State machines** (booking lifecycle, inventory_unit_movements, quote→booking conversion)
- **Multi-tenant scope** (asserting cross-tenant queries fail / return scoped subsets)

## When NOT to write integration tests

- Pure functions → `tests/unit/`
- UI rendering → e2e tests with Playwright (not set up yet)
- External-API-dependent flows that you can mock cleanly (Stripe, Twilio)

## Setup

### Option A — Supabase local (recommended for CI)

```bash
# One-time
supabase init  # if not already done
supabase start  # boots local Postgres + Auth + Storage in Docker

# Get local creds (different per machine)
supabase status
# Use the printed `API URL` + `service_role key` as env vars below
```

### Option B — Dedicated test branch

If you don't want to run Docker:

1. Create a separate Supabase project: `rentalflow-test`
2. Apply migrations: `supabase db push --linked` (after `supabase link`)
3. Use those credentials in `.env.test`

### Environment

Create `.env.test` (gitignored):

```
TEST_SUPABASE_URL=http://localhost:54321        # or your test project
TEST_SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Tests load this via `dotenv/config` at the top of `setup.ts`.

## Running

```bash
# All integration tests
npm test -- tests/integration

# A single file
npm test -- tests/integration/booking-flow.test.ts

# Watch mode
npm run test:watch -- tests/integration
```

## Patterns

### Test isolation

Each test gets a **fresh tenant** via the `createTestTenant()` helper. This avoids
data leaking between tests — easier than rolling back DB transactions which don't
play nicely with PostgREST.

```ts
import { createTestTenant, cleanupTenant } from "./fixtures";

describe("booking flow", () => {
  let tenantId: string;

  beforeEach(async () => {
    tenantId = await createTestTenant();
  });

  afterEach(async () => {
    await cleanupTenant(tenantId);
  });

  it("...", async () => { ... });
});
```

### Webhook signature simulation

For Stripe:

```ts
import Stripe from "stripe";
const stripe = new Stripe("sk_test_...");
const sig = stripe.webhooks.generateTestHeaderString({
  payload: JSON.stringify(eventPayload),
  secret: process.env.STRIPE_WEBHOOK_SECRET!,
});
```

### Asserting side effects

When an action SHOULD trigger an email/SMS/GHL sync, assert against the **ledger
table** (e.g. `booking_emails_sent`) rather than mocking the email send. The
ledger is the source of truth for idempotency anyway.

## Starter test suites

- `booking-flow.test.ts` — booking lifecycle (check-and-hold → confirm via webhook)
- `quote-conversion.test.ts` — quote→booking conversion race condition (the 2026-06-15 bug)
- `multi-tenant-isolation.test.ts` — scope.ts proxy correctness
- `inventory-state-machine.test.ts` — inventory_unit_movements transition validation

Each is ~50-150 lines. Total coverage goal: 10-20 integration tests across the 4
critical paths above.
